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
