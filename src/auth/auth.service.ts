import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { addDays, addMinutes, addSeconds } from 'date-fns';
import { type DbService, dbService } from '../db/db.module.js';
import { type MailerService, mailerService } from '../mailers/mailer.module.js';
import createTemplateEmailVerification from '../templates/email-verification.js';
import { GoogleTokenResponse, GoogleUserInfoResponse, UserSessionData } from '../utils/types.js';
import { generateOTP, generateTokenWithHash, hashToken } from '../utils/common.js';

/**
 * Service responsible for managing user authentication, sessions, and verifications.
 */

type SessionUserCache = {
    expAt: Date;
    userPayload: UserSessionData;
};

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly sessionUserCache = new Map<string, SessionUserCache>();

    constructor(
        @Inject(dbService) private readonly db: DbService,
        @Inject(mailerService) private readonly mailerService: MailerService,
        private readonly configService: ConfigService
    ) {}

    /**
     * Registers a new user.
     * @param param0 Object containing name, email, password, and providerId.
     * @returns The created user's minimal account details.
     * @throws ConflictException if the user already has an account.
     * @throws BadRequestException if the provider is not supported.
     */
    public async signUp({ name, email, password, providerId }: { name: string; email: string; password: string; providerId: 'CREDENTIALS' | 'GOOGLE' }) {
        const findUser = await this.db.user.findFirst({ where: { email } });

        if (findUser !== null) {
            const findAccount = await this.db.account.findFirst({ where: { userId: findUser.id } });
            if (findAccount !== null && findAccount.providerId === 'CREDENTIALS') {
                throw new ConflictException('account with associated user already exist');
            }
            /**
             *  --FuturePlan
             *  if account is find, and the providerId is not "CREDENTIALS"
             *  then just link user account with password
             * 
                if (findAccount !== null && findAccount.providerId !== 'CREDENTIALS') {}
             */
        }

        const newUserAccount = await this.db.$transaction(async tx => {
            const newUser = await tx.user.create({ data: { name, email } });
            await tx.account.create({
                data: { userId: newUser.id, password: await bcrypt.hash(password, 10), providerId, accountId: newUser.id }
            });

            const findRole = await tx.role.findFirst({ where: { name: 'USER' } });
            if (findRole === null) throw new NotFoundException('role is not found');

            await tx.userRole.create({ data: { userId: newUser.id, roleId: findRole.id } });
            return { userId: newUser.id, name: newUser.name, email: newUser.email, role: findRole.name };
        });

        const rawOtp = generateOTP();
        const hashedOtp = hashToken(rawOtp);
        await this.mailerService.emails.send({
            from: `NestJs-Backend <verification${this.configService.getOrThrow('APP_MAIL_NAME')}>`,
            to: email,
            subject: 'Email Verification',
            html: createTemplateEmailVerification({ email: email, otp: rawOtp })
        });

        await this.db.verification.create({
            data: {
                userId: newUserAccount.userId,
                type: 'EMAIL_VERIFICATION',
                tokenHash: hashedOtp,
                expiredAt: addMinutes(new Date(), 15)
            }
        });

        this.logger.log(`New user registered successfully: ${email} [Provider: ${providerId}]`);

        return newUserAccount;
    }

    /**
     * Authenticates a user and creates a new session.
     * @param param0 Object containing email, password, providerId, ipAddress, and userAgent.
     * @returns The raw session token and the authenticated user's details.
     * @throws UnauthorizedException if credentials are invalid.
     * @throws BadRequestException if the provider is not supported.
     */
    public async signIn({ email, password, providerId, ipAddress, userAgent }: { email: string; password: string; providerId: 'CREDENTIALS' | 'GOOGLE'; ipAddress?: string; userAgent?: string }) {
        const findUser = await this.db.user.findFirst({ where: { email } });
        if (!findUser) throw new UnauthorizedException('invalid credentials');

        const findAccount = await this.db.account.findFirst({ where: { userId: findUser.id, providerId } });
        if (!findAccount || !findAccount.password) throw new UnauthorizedException('invalid credentials');

        const isPasswordValid = await bcrypt.compare(password, findAccount.password);
        if (!isPasswordValid) throw new UnauthorizedException('invalid credentials');

        if (!findUser.verifiedAt) {
            const existingVerification = await this.db.verification.findFirst({
                where: { userId: findUser.id, type: 'EMAIL_VERIFICATION' }
            });

            if (!existingVerification || existingVerification.expiredAt < new Date()) {
                if (existingVerification) {
                    await this.db.verification.delete({ where: { id: existingVerification.id } });
                }

                const rawOtp = generateOTP();
                const hashedOtp = hashToken(rawOtp);

                await this.mailerService.emails.send({
                    from: `NestJs-Backend <verification${this.configService.getOrThrow('APP_MAIL_NAME')}>`,
                    to: email,
                    subject: 'Email Verification',
                    html: createTemplateEmailVerification({ email: email, otp: rawOtp })
                });

                await this.db.verification.create({
                    data: {
                        userId: findUser.id,
                        type: 'EMAIL_VERIFICATION',
                        tokenHash: hashedOtp,
                        expiredAt: addMinutes(new Date(), 15)
                    }
                });

                throw new UnauthorizedException('email not verified. a new verification email has been sent');
            }

            throw new UnauthorizedException('email not verified. please check your email to verify your account');
        }

        const { rawToken, hashedToken } = generateTokenWithHash();
        await this.db.session.create({
            data: {
                userId: findUser.id,
                token: hashedToken,
                expiredAt: addDays(new Date(), 7),
                ipAddress,
                userAgent
            }
        });

        this.logger.log(`User signed in successfully: ${email} [IP: ${ipAddress ?? 'Unknown'}]`);

        return { rawToken, user: { id: findUser.id, email: findUser.email, name: findUser.name } };
    }

    /**
     * Retrieves the authenticated user's payload from a valid session token.
     * @param sessionToken The raw session token.
     * @returns The authenticated user's payload.
     * @throws UnauthorizedException if the session is invalid or expired.
     */
    public async getUser(sessionToken: string): Promise<UserSessionData> {
        const hashed = hashToken(sessionToken);
        const userSessionCache = this.sessionUserCache.get(hashed) || null;
        if (userSessionCache !== null) {
            if (userSessionCache.expAt > new Date()) return userSessionCache.userPayload;
            if (userSessionCache.expAt < new Date()) this.sessionUserCache.delete(hashed);
        }

        const session = await this.db.session.findFirst({
            where: { token: hashed },
            include: { user: { include: { userRoles: { include: { role: true } } } } }
        });

        if (!session) throw new UnauthorizedException('invalid session');

        if (session.expiredAt < new Date()) {
            await this.db.session.delete({ where: { id: session.id } });
            throw new UnauthorizedException('session expired');
        }

        const payload: UserSessionData = {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            verifiedAt: session.user.verifiedAt,
            image: session.user.image,
            sessionToken: sessionToken,
            roles: session.user.userRoles.map(ur => ur.role.name as 'USER' | 'ADMIN' | 'SUPERADMIN'),
            createdAt: session.user.createdAt,
            updatedAt: session.user.updatedAt
        };

        this.sessionUserCache.set(hashed, { expAt: addMinutes(new Date(), 15), userPayload: payload });
        return payload;
    }

    /**
     * Confirms an email verification process using a token.
     * Marks the user as verified and deletes the used verification token.
     * @param param0 Object containing the user's email and verification token.
     * @returns The verified user's email.
     * @throws BadRequestException if the token is invalid or expired.
     */
    public async confirmVerification({ email, otp }: { email: string; otp: string }) {
        const hashed = hashToken(otp);

        const verification = await this.db.verification.findFirst({
            where: {
                user: { email },
                type: 'EMAIL_VERIFICATION',
                tokenHash: hashed
            },
            include: { user: true }
        });

        if (!verification || !verification.user) throw new BadRequestException('invalid or expired verification token');

        if (verification.expiredAt < new Date()) {
            await this.db.verification.delete({ where: { id: verification.id } });
            throw new BadRequestException('invalid or expired verification token');
        }

        await this.db.$transaction(async tx => {
            await tx.user.update({
                where: { id: verification.userId },
                data: { verifiedAt: new Date() }
            });

            await tx.verification.delete({
                where: { id: verification.id }
            });
        });

        return { email: verification.user.email };
    }

    /**
     * Resends the email verification OTP.
     * @param param0 Object containing the user's email.
     * @returns A success message.
     * @throws NotFoundException if the user is not found.
     * @throws BadRequestException if the user is already verified.
     */
    public async resendVerification({ email }: { email: string }) {
        const findUser = await this.db.user.findFirst({ where: { email } });
        if (!findUser) throw new NotFoundException('user not found');

        if (findUser.verifiedAt) {
            throw new BadRequestException('email already verified');
        }

        const existingVerification = await this.db.verification.findFirst({
            where: { userId: findUser.id, type: 'EMAIL_VERIFICATION' }
        });

        if (existingVerification) {
            await this.db.verification.delete({ where: { id: existingVerification.id } });
        }

        const rawOtp = generateOTP();
        const hashedOtp = hashToken(rawOtp);

        await this.mailerService.emails.send({
            from: `NestJs-Backend <verification${this.configService.getOrThrow('APP_MAIL_NAME')}>`,
            to: email,
            subject: 'Email Verification',
            html: createTemplateEmailVerification({ email: email, otp: rawOtp })
        });

        await this.db.verification.create({
            data: {
                userId: findUser.id,
                type: 'EMAIL_VERIFICATION',
                tokenHash: hashedOtp,
                expiredAt: addMinutes(new Date(), 15)
            }
        });

        return { email };
    }

    /**
     * Signs out a user by deleting their current session.
     * @param sessionToken The raw session token to be removed.
     * @returns A boolean indicating success.
     */
    public async signOut(sessionToken: string): Promise<boolean> {
        const hashed = hashToken(sessionToken);

        if (this.sessionUserCache.has(hashed)) {
            this.sessionUserCache.delete(hashed);
        }

        const session = await this.db.session.findFirst({ where: { token: hashed } });
        if (session) {
            await this.db.session.delete({ where: { id: session.id } });
            this.logger.log(`Session terminated for user ID: ${session.userId}`);
        } else {
            this.logger.warn(`Attempted to sign out an invalid or already deleted session`);
        }

        return true;
    }

    /**
     * Handles the callback from Google OAuth2, fetches user information, and registers or logs in the user.
     * @param param0 Object containing the authorization code, IP address, and user agent.
     * @returns An object containing the new raw session token.
     * @throws UnauthorizedException if Google authentication fails or user info cannot be retrieved.
     * @throws NotFoundException if the default user role is not found.
     */
    public async googleSocialCallback({ code, ipAddress, userAgent }: { code: string; ipAddress?: string; userAgent?: string }) {
        const tokenResponse = await fetch(this.configService.getOrThrow<string>('GOOGLE_FETCH_TOKEN_URL'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
                client_secret: this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
                redirect_uri: this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new UnauthorizedException('Failed to authenticate with Google', error);
        }

        const googleTokenResponse: GoogleTokenResponse = await tokenResponse.json();
        const userInfoResponse = await fetch(this.configService.getOrThrow<string>('GOOGLE_FETCH_USER_INFO_URL'), {
            headers: { Authorization: `Bearer ${googleTokenResponse.access_token}` }
        });

        if (!userInfoResponse.ok) throw new UnauthorizedException('Failed to retrieve Google user information');
        const googleUserInfoResponse: GoogleUserInfoResponse = await userInfoResponse.json();

        // find user
        let userId: string | null = null;
        const findUser = await this.db.user.findFirst({ where: { email: googleUserInfoResponse.email } });
        if (findUser !== null) {
            userId = findUser.id;
            const findAccount = await this.db.account.findFirst({ where: { userId: findUser.id, providerId: 'GOOGLE' } });
            // find account
            if (findAccount !== null) {
                await this.db.account.update({
                    where: { userId_providerId: { userId: findUser.id, providerId: 'GOOGLE' } },
                    data: {
                        accessToken: googleTokenResponse.access_token,
                        refreshToken: googleTokenResponse.refresh_token,
                        accessTokenExpiredAt: addSeconds(new Date(), googleTokenResponse.expires_in),
                        scope: googleTokenResponse.scope,
                        idToken: googleTokenResponse.id_token
                    }
                });
            }
            // if account not find
            else {
                await this.db.account.create({
                    data: {
                        userId: findUser.id,
                        accountId: googleUserInfoResponse.sub,
                        providerId: 'GOOGLE',
                        accessToken: googleTokenResponse.access_token,
                        refreshToken: googleTokenResponse.refresh_token,
                        accessTokenExpiredAt: addSeconds(new Date(), googleTokenResponse.expires_in),
                        scope: googleTokenResponse.scope,
                        idToken: googleTokenResponse.id_token
                    }
                });
            }
        }
        // if user not find
        else {
            await this.db.$transaction(async tx => {
                const newUser = await tx.user.create({
                    data: {
                        name: googleUserInfoResponse.name,
                        email: googleUserInfoResponse.email,
                        image: googleUserInfoResponse.picture,
                        verifiedAt: new Date()
                    }
                });

                userId = newUser.id;
                await tx.account.create({
                    data: {
                        userId: newUser.id,
                        accountId: googleUserInfoResponse.sub,
                        providerId: 'GOOGLE',
                        accessToken: googleTokenResponse.access_token,
                        refreshToken: googleTokenResponse.refresh_token,
                        accessTokenExpiredAt: addSeconds(new Date(), googleTokenResponse.expires_in),
                        scope: googleTokenResponse.scope,
                        idToken: googleTokenResponse.id_token
                    }
                });

                const findRole = await tx.role.findFirst({ where: { name: 'USER' } });
                if (findRole === null) throw new NotFoundException('role is not found');

                await tx.userRole.create({ data: { userId: newUser.id, roleId: findRole.id } });
                return { userId: newUser.id, name: newUser.name, email: newUser.email, role: findRole.name };
            });
        }

        const { rawToken, hashedToken } = generateTokenWithHash();
        await this.db.session.create({ data: { userId: userId!, ipAddress, userAgent, token: hashedToken, expiredAt: addDays(new Date(), 7) } });
        return { rawToken };
    }
}
