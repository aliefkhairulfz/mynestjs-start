import { createHmac, randomBytes } from 'crypto';
import 'dotenv/config';
import { Response } from 'express';

const authSecret = process.env.AUTH_SECRET;
const appEnv = process.env.APP_ENV;

/**
 * Generates a random raw token and its corresponding SHA-256 hash.
 * Useful for creating session tokens and verification hashes.
 * @returns An object containing the raw base64url token and its hex hash.
 */
export function generateTokenWithHash() {
    if (authSecret === undefined) throw new Error('authSecret not found');
    const rawToken = randomBytes(32).toString('base64url');
    const hashedToken = createHmac('sha256', authSecret).update(rawToken).digest('hex');
    return { rawToken, hashedToken };
}

/**
 * Hashes a given raw token using SHA-256 and the application's auth secret.
 * @param rawToken The plain text token to hash.
 * @returns The hex representation of the hashed token.
 */
export function hashToken(rawToken: string) {
    if (authSecret === undefined) throw new Error('authSecret not found');
    return createHmac('sha256', authSecret).update(rawToken).digest('hex');
}

/**
 * Sets a secure, HTTP-only session cookie on the Express response object.
 * Adjusts the domain and secure flags based on the environment (production vs development).
 * @param response The Express response object.
 * @param token The raw session token to store in the cookie.
 */
export function setSessionCookie(response: Response, token: string): void {
    if (appEnv === undefined) throw new Error('appEnv not found');
    const isProduction = appEnv === 'production';

    response.cookie('nestsession', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        domain: !isProduction ? 'localhost' : '.neststarterkit.cloud',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });
}

/**
 * Clears the session cookie from the client's browser.
 * Uses the same domain and path settings as the set cookie to ensure successful deletion.
 * @param response The Express response object.
 */
export function clearSessionCookie(response: Response): void {
    if (appEnv === undefined) throw new Error('appEnv not found');
    const isProduction = appEnv === 'production';

    response.clearCookie('nestsession', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        domain: !isProduction ? 'localhost' : '.neststarterkit.cloud',
        path: '/'
    });
}
