import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { ConfirmVerificationReqDto, SignInReqDto, SignUpReqDto, SignUpResDto, SignInResDto, GetUserResDto, ConfirmVerificationResDto } from './dto/auth.dto.js';
import type { Request, Response } from 'express';
import { setSessionCookie, clearSessionCookie } from '../utils/utils.js';
import { AuthGuard } from '../utils/guard.js';

/**
 * Controller handling authentication endpoints such as sign-up, sign-in, and session retrieval.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

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

        setSessionCookie(res, data.rawToken);
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
        const data = await this.authService.confirmVerification({ email: dto.email, token: dto.token });
        return { data, message: 'email verification success' };
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
        clearSessionCookie(res);
        return { message: 'sign-out success' };
    }
}
