export type UserSessionData = {
    id: string;
    name: string;
    email: string;
    verifiedAt: Date | null;
    image: string | null;
    sessionToken: string;
    roles: ('user' | 'admin' | 'superadmin')[];
    createdAt: Date;
    updatedAt: Date;
};

export type GoogleTokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token: string;
};

export type GoogleUserInfoResponse = {
    sub: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    email: string;
    email_verified: boolean;
};

export type CreatedOrUpdatedAccount = {
    password: string | null;
    providerId: 'credentials' | 'google';
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    accountId: string;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiredAt: Date | null;
    refreshTokenExpiredAt: Date | null;
    scope: string | null;
    idToken: string | null;
};
