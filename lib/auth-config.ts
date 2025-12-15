import { SessionOptions } from 'iron-session';

export const clientConfig = {
    url: process.env.NEXT_PUBLIC_OIDC_URL,
    audience: process.env.NEXT_PUBLIC_OIDC_URL,
    client_id: process.env.NEXT_PUBLIC_CLIENT_ID,
    scope: process.env.NEXT_PUBLIC_SCOPE,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/oidc`,
    post_logout_redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}`,
    response_type: 'code',
    grant_type: 'authorization_code',
    post_login_route: `${process.env.NEXT_PUBLIC_APP_URL}`,
    code_challenge_method: 'S256',
};

export interface SessionData {
    isLoggedIn: boolean;
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_at?: number;
    code_verifier?: string;
    state?: string;
    userInfo?: {
        sub: string;
        name: string;
        email: string;
        email_verified: boolean;
        username?: string;
        role?: string;
    };
}

export const defaultSession: SessionData = {
    isLoggedIn: false,
    access_token: undefined,
    refresh_token: undefined,
    id_token: undefined,
    expires_at: undefined,
    code_verifier: undefined,
    state: undefined,
    userInfo: undefined,
};

export const sessionOptions: SessionOptions = {
    password: process.env.BETTER_AUTH_SECRET!,
    cookieName: 'next_js_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
    },
    ttl: 60 * 60 * 24 * 7, // 1 week
};
