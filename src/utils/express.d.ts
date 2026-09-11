import { UserSessionData } from './types.ts';

declare module 'express' {
    interface Request {
        withUser: UserSessionData | undefined;
    }
}
