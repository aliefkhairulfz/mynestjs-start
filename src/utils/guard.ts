import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { ConfigService } from '@nestjs/config';

export const AuthGuardsIsOptional = () => SetMetadata('optional', true);

/**
 * Guard that ensures the incoming request has a valid session token.
 * Populates req.withUser if the token is valid, otherwise throws UnauthorizedException.
 * Skips authentication if the route is marked with AuthGuardsIsOptional.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(
        private readonly authService: AuthService,
        private readonly reflector: Reflector,
        private readonly configService: ConfigService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isOptional = this.reflector.get<boolean>('optional', context.getHandler());
        const request = context.switchToHttp().getRequest<Request>();
        let sessionToken: string;

        try {
            sessionToken = this.extractToken(request);
        } catch (error) {
            if (isOptional) return true;
            this.logger.warn(`Failed authentication on required route: ${request.method} ${request.originalUrl}`);
            throw error;
        }

        try {
            const payload = await this.authService.getUser(sessionToken);
            request.withUser = payload;
            this.logger.debug(`User authenticated: ${payload.email} for ${request.method} ${request.originalUrl}`);
            return true;
        } catch (error) {
            if (isOptional) return true;
            this.logger.warn(`Failed authentication for token: ${request.method} ${request.originalUrl}`);
            throw error;
        }
    }

    private extractToken(req: Request) {
        const sessionToken = req.cookies[this.configService.getOrThrow<string>('SESSION_COOKIE_NAME')] as string | undefined;
        if (!sessionToken || sessionToken === undefined) throw new UnauthorizedException('session token not found');
        return sessionToken;
    }
}

export enum Role {
    USER = 'USER',
    CREATOR = 'CREATOR',
    ADMIN = 'ADMIN',
    SUPERADMIN = 'SUPERADMIN'
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Guard that verifies if the authenticated user has the required roles.
 * Must be used in conjunction with AuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles) return true;

        const request = context.switchToHttp().getRequest<Request>();
        const currentUser = request.withUser;

        if (currentUser === undefined) {
            this.logger.warn(`Authorization failed: No user found on request for ${request.method} ${request.originalUrl}`);
            return false;
        }
        
        const hasRole = requiredRoles.some(role => currentUser.roles.includes(role));
        if (!hasRole) {
            this.logger.warn(`Authorization failed: User ${currentUser.email} lacks required roles [${requiredRoles.join(', ')}]`);
        }
        return hasRole;
    }
}
