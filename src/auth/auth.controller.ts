import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { AuthGuard } from '../utils/guard.js';
import { clearSessionCookie, generateTokenWithHash, hashToken, setSessionCookie } from '../utils/utils.js';
import { AuthService } from './auth.service.js';
import { ConfirmVerificationReqDto, ConfirmVerificationResDto, GetUserResDto, ResendVerificationReqDto, SignInReqDto, SignInResDto, SignUpReqDto, SignUpResDto } from './dto/auth.dto.js';
import { SkipResponseInterceptor } from '../utils/interceptors.js';

/**
 * Controller handling authentication endpoints such as sign-up, sign-in, and session retrieval.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService
    ) {}

    /**
     * Handles user registration/sign-up.
     * @param dto Data transfer object containing user registration details.
     * @returns A success message along with the created user's basic information.
     */
    @Post('sign-up')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, type: SignUpResDto, description: 'User successfully registered. A verification email is sent to the user.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    public async signUp(@Body() dto: SignUpReqDto) {
        const data = await this.authService.signUp({ name: dto.name, email: dto.email, password: dto.password, providerId: dto.providerId });
        return { data, message: 'sign-up success' };
    }

    /**
     * Handles user sign-in and establishes a session.
     * Sets a session cookie if credentials are valid.
     * @param dto Data transfer object containing sign-in credentials.
     * @param req The incoming Express request, used to extract IP and user agent.
     * @param res The outgoing Express response, used to set the session cookie.
     * @returns A success message along with the authenticated user's information.
     */
    @Post('sign-in')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Sign in a user' })
    @ApiResponse({ status: 200, type: SignInResDto, description: 'User successfully signed in. Sets a session cookie (`sessionToken`) in the response headers.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    public async signIn(@Body() dto: SignInReqDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'];

        const data = await this.authService.signIn({
            email: dto.email,
            password: dto.password,
            providerId: dto.providerId,
            ipAddress,
            userAgent
        });

        setSessionCookie({
            response: res,
            token: data.rawToken,
            cookieName: this.configService.getOrThrow<string>('SESSION_COOKIE_NAME'),
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return { data: data.user, message: 'sign-in success' };
    }

    /**
     * Retrieves the currently authenticated user's profile information.
     * Requires a valid session cookie (handled by AuthGuard).
     * @param req The incoming Express request containing the user payload.
     * @returns A success message along with the user's data.
     */
    @Get('me')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, type: GetUserResDto, description: 'User profile retrieved successfully from the active session cookie.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    public async getUser(@Req() req: Request) {
        return { data: req.withUser, message: 'get-user success' };
    }

    /**
     * Confirms a user's email verification using a provided token.
     * @param dto Data transfer object containing the email and verification token.
     * @returns A success message along with the verified user's email.
     */
    @Post('confirm-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm email verification' })
    @ApiResponse({ status: 200, type: ConfirmVerificationResDto, description: 'Email successfully verified. Verification token is removed and user is marked as verified.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    public async confirmVerification(@Body() dto: ConfirmVerificationReqDto) {
        const data = await this.authService.confirmVerification({ email: dto.email, otp: dto.otp });
        return { data, message: 'email verification success' };
    }

    /**
     * Resends the verification OTP email.
     * @param dto Data transfer object containing the email.
     * @returns A success message.
     */
    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend email verification OTP' })
    @ApiResponse({ status: 200, description: 'Email verification OTP successfully resent.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    public async resendVerification(@Body() dto: ResendVerificationReqDto) {
        const data = await this.authService.resendVerification({ email: dto.email });
        return { data, message: 'email verification resent success' };
    }

    /**
     * Handles user sign-out and clears the session.
     * @param req The incoming Express request containing the user payload.
     * @param res The outgoing Express response, used to clear the session cookie.
     * @returns A success message.
     */
    @Post('sign-out')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sign out a user' })
    @ApiResponse({ status: 200, description: 'User successfully signed out. Clears the session cookie.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    public async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        if (req.withUser?.sessionToken) {
            await this.authService.signOut(req.withUser.sessionToken);
        }
        clearSessionCookie({
            response: res,
            cookieName: this.configService.getOrThrow<string>('SESSION_COOKIE_NAME')
        });
        return { message: 'sign-out success' };
    }

    /**
     * Initiates Google OAuth2 sign-in flow.
     * Redirects the user to Google's authorization page.
     * @param response The outgoing Express response, used for redirection and setting temporary cookie.
     * @returns A redirection to Google's authorization URL.
     */
    @Get('google')
    @ApiOperation({ summary: 'Initiate Google sign-in' })
    @ApiResponse({ status: 302, description: 'Redirects to Google OAuth authorization URL.' })
    @SkipResponseInterceptor()
    public async googleSocialSignIn(@Res({ passthrough: true }) response: Response) {
        const { rawToken, hashedToken } = generateTokenWithHash();
        setSessionCookie({
            response,
            token: rawToken,
            cookieName: this.configService.getOrThrow<string>('GOOGLE_TOKEN_EXCHANGE_COOKIE_NAME'),
            maxAge: 10 * 60 * 1000
        });

        const authorizationUrl = new URL(this.configService.getOrThrow<string>('GOOGLE_AUTHORIZATION_URL'));
        authorizationUrl.searchParams.set('client_id', this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'));
        authorizationUrl.searchParams.set('redirect_uri', this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI'));
        authorizationUrl.searchParams.set('response_type', 'code');
        authorizationUrl.searchParams.set('scope', 'openid email profile');
        authorizationUrl.searchParams.set('access_type', 'offline');
        authorizationUrl.searchParams.set('prompt', 'consent');

        authorizationUrl.searchParams.set('state', hashedToken);
        return response.redirect(authorizationUrl.toString());
    }

    /**
     * Handles the callback from Google OAuth2 sign-in.
     * Validates the state, exchanges the authorization code for tokens, and establishes a user session.
     * @param code The authorization code from Google.
     * @param state The state token from Google, used for CSRF protection.
     * @param req The incoming Express request, used to extract IP and user agent.
     * @param res The outgoing Express response, used to set the session cookie and redirect.
     * @returns A redirection to the frontend's profile/me page.
     */
    @Get('google/callback')
    @ApiOperation({ summary: 'Handle Google sign-in callback' })
    @ApiResponse({ status: 302, description: 'Redirects to the frontend after successfully authenticating and setting session cookie.' })
    @ApiResponse({ status: 401, description: 'Unauthorized (invalid state, missing code/state, etc.).' })
    @SkipResponseInterceptor()
    public async googleSocialCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        if (!code || !state) throw new UnauthorizedException('[Code, State] not Found');

        const storedRawToken = req.cookies[this.configService.getOrThrow<string>('GOOGLE_TOKEN_EXCHANGE_COOKIE_NAME')];
        if (!storedRawToken) throw new UnauthorizedException('OAuth state is missing');

        const hashStoredRawToken = hashToken(storedRawToken);
        if (hashStoredRawToken !== state) throw new UnauthorizedException('Invalid OAuth state');

        clearSessionCookie({
            response: res,
            cookieName: this.configService.getOrThrow<string>('GOOGLE_TOKEN_EXCHANGE_COOKIE_NAME')
        });

        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'];

        const newOrUpdateUserAccount = await this.authService.googleSocialCallback({ code, ipAddress, userAgent });
        setSessionCookie({
            response: res,
            token: newOrUpdateUserAccount.rawToken,
            cookieName: this.configService.getOrThrow<string>('SESSION_COOKIE_NAME'),
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return res.redirect(`${this.configService.getOrThrow<string>('FRONTEND_URL')}/dashboard`);
    }
}
