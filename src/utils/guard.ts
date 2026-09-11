import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

export const AuthGuardsIsOptional = () => SetMetadata('optional', true);

/**
 * Guard that ensures the incoming request has a valid session token.
 * Populates req.withUser if the token is valid, otherwise throws UnauthorizedException.
 * Skips authentication if the route is marked with AuthGuardsIsOptional.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isOptional = this.reflector.get<boolean>('optional', context.getHandler());
        const request = context.switchToHttp().getRequest<Request>();
        const sessionToken = this.extractToken(request);

        if (isOptional) return true;
        const payload = await this.authService.getUser(sessionToken);
        request.withUser = payload;
        return true;
    }

    private extractToken(req: Request) {
        const sessionToken = req.cookies['nestsession'] as string | undefined;
        if (!sessionToken || sessionToken === undefined) throw new UnauthorizedException('session token not found');
        return sessionToken;
    }
}

export enum Role {
    User = 'user',
    Admin = 'admin',
    Superadmin = 'superadmin'
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Guard that verifies if the authenticated user has the required roles.
 * Must be used in conjunction with AuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles) return true;

        const request = context.switchToHttp().getRequest<Request>();
        const currentUser = request.withUser;

        if (currentUser === undefined) return false;
        return requiredRoles.some(role => currentUser.roles.includes(role));
    }
}
