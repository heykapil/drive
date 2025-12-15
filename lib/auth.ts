import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import * as client from 'openid-client';
import { cache } from 'react';
import {
  SessionData,
  defaultSession,
  sessionOptions,
  clientConfig
} from './auth-config';

export { clientConfig, defaultSession, sessionOptions };
export type { SessionData };

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

  // Refresh token logic has been moved to middleware
  if (session.isLoggedIn && session.expires_at) {
    // Logic moved to middleware.ts
  }

  return session;
});

export async function getClientConfig() {
  return await client.discovery(
    new URL(clientConfig.url!),
    clientConfig.client_id!,
  );
}
