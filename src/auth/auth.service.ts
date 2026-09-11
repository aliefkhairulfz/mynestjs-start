import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { addDays, addMinutes } from 'date-fns';
import { type DbService, dbService } from '../db/db.module.js';
import { type MailerService, mailerService } from '../mailer/mailer.module.js';
import createTemplateEmailVerification from '../templates/email-verification.js';
import { UserSessionData } from '../utils/types.js';
import { generateTokenWithHash, hashToken } from '../utils/utils.js';

/**
 * Service responsible for managing user authentication, sessions, and verifications.
 */

type SessionUserCache = {
    expAt: Date;
    userPayload: UserSessionData;
};

@Injectable()
export class AuthService {
    private readonly sessionUserCache = new Map<string, SessionUserCache>();
    private readonly logger = new Logger(AuthService.name);

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
    public async signUp({ name, email, password, providerId }: { name: string; email: string; password: string; providerId: 'credentials' | 'socials' }) {
        if (providerId === 'credentials') {
            const findUser = await this.db.user.findFirst({ where: { email } });

            if (findUser !== null) {
                const findAccount = await this.db.account.findFirst({ where: { userId: findUser.id } });
                if (findAccount !== null) throw new ConflictException('account with associated user already exist');
            }

            const newUserAccount = await this.db.$transaction(async tx => {
                const newUser = await tx.user.create({ data: { name, email } });
                await tx.account.create({
                    data: { userId: newUser.id, password: await bcrypt.hash(password, 10), providerId, accountId: newUser.id }
                });

                const findRole = await tx.role.findFirst({ where: { name: 'user' } });
                if (findRole === null) throw new NotFoundException('role is not found');

                await tx.userRole.create({ data: { userId: newUser.id, roleId: findRole.id } });
                return { userId: newUser.id, name: newUser.name, email: newUser.email, role: findRole.name };
            });

            const { rawToken, hashedToken } = generateTokenWithHash();
            const redirectUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/email-verification?e=${email}&t=${rawToken}`;
            await this.mailerService.emails.send({
                from: `NestJs-Backend <verification${this.configService.getOrThrow('APP_MAIL_NAME')}>`,
                to: email,
                subject: 'Email Verification',
                html: createTemplateEmailVerification({ email: email, redirectUrl })
            });

            await this.db.verification.create({
                data: {
                    userId: newUserAccount.userId,
                    type: 'emailVerification',
                    tokenHash: hashedToken,
                    expiredAt: addDays(new Date(), 1)
                }
            });

            return newUserAccount;
        } else {
            throw new BadRequestException('non-credentials not exist yet through this service');
        }
    }

    /**
     * Authenticates a user and creates a new session.
     * @param param0 Object containing email, password, providerId, ipAddress, and userAgent.
     * @returns The raw session token and the authenticated user's details.
     * @throws UnauthorizedException if credentials are invalid.
     * @throws BadRequestException if the provider is not supported.
     */
    public async signIn({ email, password, providerId, ipAddress, userAgent }: { email: string; password: string; providerId: 'credentials' | 'socials'; ipAddress?: string; userAgent?: string }) {
        if (providerId === 'credentials') {
            const findUser = await this.db.user.findFirst({ where: { email } });
            if (!findUser) throw new UnauthorizedException('invalid credentials');

            const findAccount = await this.db.account.findFirst({ where: { userId: findUser.id, providerId } });
            if (!findAccount || !findAccount.password) throw new UnauthorizedException('invalid credentials');

            const isPasswordValid = await bcrypt.compare(password, findAccount.password);
            if (!isPasswordValid) throw new UnauthorizedException('invalid credentials');

            if (!findUser.verifiedAt) {
                const existingVerification = await this.db.verification.findFirst({
                    where: { userId: findUser.id, type: 'emailVerification' }
                });

                if (!existingVerification || existingVerification.expiredAt < new Date()) {
                    if (existingVerification) {
                        await this.db.verification.delete({ where: { id: existingVerification.id } });
                    }

                    const { rawToken, hashedToken } = generateTokenWithHash();
                    const redirectUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/email-verification?e=${email}&t=${rawToken}`;
                    
                    await this.mailerService.emails.send({
                        from: `NestJs-Backend <verification${this.configService.getOrThrow('APP_MAIL_NAME')}>`,
                        to: email,
                        subject: 'Email Verification',
                        html: createTemplateEmailVerification({ email: email, redirectUrl })
                    });

                    await this.db.verification.create({
                        data: {
                            userId: findUser.id,
                            type: 'emailVerification',
                            tokenHash: hashedToken,
                            expiredAt: addDays(new Date(), 1)
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

            return { rawToken, user: { id: findUser.id, email: findUser.email, name: findUser.name } };
        } else {
            throw new BadRequestException('non-credentials not exist yet through this service');
        }
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
            this.logger.debug('userSessionCache exist', userSessionCache);
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
            roles: session.user.userRoles.map(ur => ur.role.name as 'user' | 'admin' | 'superadmin'),
            createdAt: session.user.createdAt,
            updatedAt: session.user.updatedAt
        };

        this.sessionUserCache.set(hashed, { expAt: addMinutes(new Date(), 15), userPayload: payload });
        this.logger.debug('userSessionCache set', payload);
        return payload;
    }

    /**
     * Confirms an email verification process using a token.
     * Marks the user as verified and deletes the used verification token.
     * @param param0 Object containing the user's email and verification token.
     * @returns The verified user's email.
     * @throws BadRequestException if the token is invalid or expired.
     */
    public async confirmVerification({ email, token }: { email: string; token: string }) {
        const hashed = hashToken(token);

        const verification = await this.db.verification.findFirst({
            where: {
                user: { email },
                type: 'emailVerification',
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
        }

        return true;
    }
}
