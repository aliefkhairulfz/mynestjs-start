import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthGuard } from '../utils/guard.js';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        signUp: vi.fn(),
                        signIn: vi.fn(),
                        getUser: vi.fn(),
                        confirmVerification: vi.fn(),
                        resendVerification: vi.fn(),
                        signOut: vi.fn()
                    }
                },
                {
                    provide: ConfigService,
                    useValue: {
                        getOrThrow: vi.fn().mockReturnValue('mock-value')
                    }
                }
            ]
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: vi.fn(() => true) })
            .compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should call signUp', async () => {
        const dto = { name: 'Test', email: 'test@example.com', password: 'password', providerId: 'credentials' as const };
        const result = { userId: '1', name: 'Test', email: 'test@example.com', role: 'user' as const };
        vi.spyOn(authService, 'signUp').mockResolvedValue(result);

        const response = await controller.signUp(dto);
        expect(authService.signUp).toHaveBeenCalledWith({ name: dto.name, email: dto.email, password: dto.password, providerId: dto.providerId });
        expect(response).toEqual({ data: result, message: 'sign-up success' });
    });

    it('should call signIn and set cookie', async () => {
        const dto = { email: 'test@example.com', password: 'password', providerId: 'credentials' as const };
        const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } } as unknown as Request;
        const res = { cookie: vi.fn() } as unknown as Response;
        const result = { rawToken: 'token', user: { id: '1', email: 'test@example.com', name: 'Test' } };
        vi.spyOn(authService, 'signIn').mockResolvedValue(result);

        process.env.APP_ENV = 'development';

        const response = await controller.signIn(dto, req, res);
        expect(authService.signIn).toHaveBeenCalledWith({
            email: dto.email,
            password: dto.password,
            providerId: dto.providerId,
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent'
        });
        expect(res.cookie).toHaveBeenCalled();
        expect(response).toEqual({ data: result.user, message: 'sign-in success' });
    });

    it('should get user', async () => {
        const req = { withUser: { id: '1', email: 'test@example.com' } } as unknown as Request;
        const response = await controller.getUser(req);
        expect(response).toEqual({ data: req.withUser, message: 'get-user success' });
    });

    it('should call confirmVerification', async () => {
        const dto = { email: 'test@example.com', otp: '123456' };
        vi.spyOn(authService, 'confirmVerification').mockResolvedValue({ email: 'test@example.com' });

        const response = await controller.confirmVerification(dto);
        expect(authService.confirmVerification).toHaveBeenCalledWith(dto);
        expect(response).toEqual({ data: { email: 'test@example.com' }, message: 'email verification success' });
    });

    it('should call resendVerification', async () => {
        const dto = { email: 'test@example.com' };
        vi.spyOn(authService, 'resendVerification').mockResolvedValue({ email: 'test@example.com' });

        const response = await controller.resendVerification(dto);
        expect(authService.resendVerification).toHaveBeenCalledWith(dto);
        expect(response).toEqual({ data: { email: 'test@example.com' }, message: 'email verification resent success' });
    });

    it('should call signOut and clear cookie', async () => {
        const req = { withUser: { sessionToken: 'token' } } as unknown as Request;
        const res = { clearCookie: vi.fn() } as unknown as Response;
        
        process.env.APP_ENV = 'development';
        
        const response = await controller.signOut(req, res);
        expect(authService.signOut).toHaveBeenCalledWith('token');
        expect(res.clearCookie).toHaveBeenCalled();
        expect(response).toEqual({ message: 'sign-out success' });
    });
});
