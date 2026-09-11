import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { dbService } from '../db/db.module.js';
import { mailerService } from '../mailer/mailer.module.js';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { generateTokenWithHash, hashToken } from '../utils/utils.js';

vi.mock('bcrypt');
vi.mock('../utils/utils.js', async importOriginal => {
    const mod = await importOriginal<typeof import('../utils/utils.js')>();
    return {
        ...mod,
        generateTokenWithHash: vi.fn(),
        hashToken: vi.fn()
    };
});

describe('AuthService', () => {
    let service: AuthService;
    let dbMock: any;
    let mailerMock: any;
    let configMock: any;

    beforeEach(async () => {
        dbMock = {
            user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
            account: { findFirst: vi.fn(), create: vi.fn() },
            session: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
            verification: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
            role: { findFirst: vi.fn() },
            userRole: { create: vi.fn() },
            $transaction: vi.fn(cb => cb(dbMock))
        };

        mailerMock = {
            emails: { send: vi.fn() }
        };

        configMock = {
            getOrThrow: vi.fn().mockReturnValue('mock-val'),
            get: vi.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [AuthService, { provide: dbService, useValue: dbMock }, { provide: mailerService, useValue: mailerMock }, { provide: ConfigService, useValue: configMock }]
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('signIn', () => {
        it('should throw if user not found', async () => {
            dbMock.user.findFirst.mockResolvedValue(null);
            await expect(service.signIn({ email: 'test@test.com', password: 'password', providerId: 'credentials' })).rejects.toThrow(UnauthorizedException);
        });

        it('should throw if password does not match', async () => {
            dbMock.user.findFirst.mockResolvedValue({ id: '1', email: 'test@test.com' });
            dbMock.account.findFirst.mockResolvedValue({ password: 'hashed' });
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            await expect(service.signIn({ email: 'test@test.com', password: 'password', providerId: 'credentials' })).rejects.toThrow(UnauthorizedException);
        });

        it('should create session and return raw token', async () => {
            dbMock.user.findFirst.mockResolvedValue({ id: '1', email: 'test@test.com', name: 'Test', verifiedAt: new Date() });
            dbMock.account.findFirst.mockResolvedValue({ password: 'hashed' });
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.mocked(generateTokenWithHash).mockReturnValue({ rawToken: 'raw', hashedToken: 'hashed' });

            const result = await service.signIn({ email: 'test@test.com', password: 'password', providerId: 'credentials' });

            expect(dbMock.session.create).toHaveBeenCalled();
            expect(result).toEqual({ rawToken: 'raw', user: { id: '1', email: 'test@test.com', name: 'Test' } });
        });

        it('should throw and resend verification email if unverified and token expired', async () => {
            dbMock.user.findFirst.mockResolvedValue({ id: '1', email: 'test@test.com', name: 'Test', verifiedAt: null });
            dbMock.account.findFirst.mockResolvedValue({ password: 'hashed' });
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            dbMock.verification.findFirst.mockResolvedValue({ id: 'v1', expiredAt: new Date(Date.now() - 10000) }); // expired
            vi.mocked(generateTokenWithHash).mockReturnValue({ rawToken: 'raw', hashedToken: 'hashed' });

            await expect(service.signIn({ email: 'test@test.com', password: 'password', providerId: 'credentials' })).rejects.toThrow('email not verified. a new verification email has been sent');

            expect(dbMock.verification.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
            expect(mailerMock.emails.send).toHaveBeenCalled();
            expect(dbMock.verification.create).toHaveBeenCalled();
        });

        it('should throw if unverified but token is not expired', async () => {
            dbMock.user.findFirst.mockResolvedValue({ id: '1', email: 'test@test.com', name: 'Test', verifiedAt: null });
            dbMock.account.findFirst.mockResolvedValue({ password: 'hashed' });
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            dbMock.verification.findFirst.mockResolvedValue({ id: 'v1', expiredAt: new Date(Date.now() + 100000) }); // not expired

            await expect(service.signIn({ email: 'test@test.com', password: 'password', providerId: 'credentials' })).rejects.toThrow('email not verified. please check your email to verify your account');

            expect(dbMock.verification.delete).not.toHaveBeenCalled();
            expect(mailerMock.emails.send).not.toHaveBeenCalled();
            expect(dbMock.verification.create).not.toHaveBeenCalled();
        });
    });

    describe('confirmVerification', () => {
        it('should throw if token is invalid', async () => {
            vi.mocked(hashToken).mockReturnValue('hashed');
            dbMock.verification.findFirst.mockResolvedValue(null);

            await expect(service.confirmVerification({ email: 'test@test.com', token: 'token' })).rejects.toThrow(BadRequestException);
        });

        it('should confirm verification and delete token', async () => {
            const dateInFuture = new Date();
            dateInFuture.setFullYear(dateInFuture.getFullYear() + 1);

            vi.mocked(hashToken).mockReturnValue('hashed');
            dbMock.verification.findFirst.mockResolvedValue({ id: '1', userId: 'user1', expiredAt: dateInFuture, user: { email: 'test@test.com' } });

            const result = await service.confirmVerification({ email: 'test@test.com', token: 'token' });

            expect(dbMock.user.update).toHaveBeenCalledWith({ where: { id: 'user1' }, data: { verifiedAt: expect.any(Date) } });
            expect(dbMock.verification.delete).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toEqual({ email: 'test@test.com' });
        });
    });

    describe('signOut', () => {
        it('should delete session from db', async () => {
            vi.mocked(hashToken).mockReturnValue('hashed');
            dbMock.session.findFirst.mockResolvedValue({ id: 'session-id' });

            const result = await service.signOut('raw-token');

            expect(hashToken).toHaveBeenCalledWith('raw-token');
            expect(dbMock.session.findFirst).toHaveBeenCalledWith({ where: { token: 'hashed' } });
            expect(dbMock.session.delete).toHaveBeenCalledWith({ where: { id: 'session-id' } });
            expect(result).toBe(true);
        });

        it('should ignore if session not found', async () => {
            vi.mocked(hashToken).mockReturnValue('hashed');
            dbMock.session.findFirst.mockResolvedValue(null);

            const result = await service.signOut('raw-token');

            expect(dbMock.session.delete).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});
