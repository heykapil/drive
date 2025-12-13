import { IronSession, SessionOptions, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import * as client from 'openid-client';

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

import { cache } from 'react';

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

export const getSession = cache(async function getSession(): Promise<IronSession<SessionData>> {
  const cookiesList = await cookies();
  const session = await getIronSession<SessionData>(
    cookiesList,
    sessionOptions,
  );
  if (!session.isLoggedIn) {
    session.access_token = defaultSession.access_token;
    session.userInfo = defaultSession.userInfo;
  }

  // Refresh token logic
  if (session.isLoggedIn && session.expires_at && session.refresh_token) {
    const expiresAtMs = session.expires_at * 1000;
    const refreshThreshold = expiresAtMs - (5 * 60 * 1000);
    const now = Date.now();

    // console.log(`[Auth] Checking refresh: Now=${now}, ExpiresAt=${expiresAtMs}, Threshold=${refreshThreshold}, ShouldRefresh=${now >= refreshThreshold}`);

    // Refresh 5 minutes before expiration
    if (now >= refreshThreshold) {
      console.log('[Auth] Token close to expiry, refreshing...');
      try {
        const openIdClientConfig = await getClientConfig();
        const tokenSet = await client.refreshTokenGrant(
          openIdClientConfig,
          session.refresh_token,
        );

        console.log('[Auth] Token refresh success');
        session.access_token = tokenSet.access_token;
        if (tokenSet.refresh_token) {
          session.refresh_token = tokenSet.refresh_token;
        }
        if (tokenSet.expires_in) {
          session.expires_at = Math.floor(Date.now() / 1000) + tokenSet.expires_in;
        }
        await session.save();
      } catch (error) {
        console.error('[Auth] Failed to refresh token:', error);
        session.isLoggedIn = false;
        session.access_token = undefined;
        session.refresh_token = undefined;
        session.id_token = undefined;
        session.userInfo = undefined;
        await session.save();
      }
    }
  } else {
    // console.log(`[Auth] No refresh needed or missing data. LoggedIn=${session.isLoggedIn}`);
  }

  return session;

  return session;
});

export async function getClientConfig() {
  return await client.discovery(
    new URL(clientConfig.url!),
    clientConfig.client_id!,
  );
}
