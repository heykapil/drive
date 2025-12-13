import { clientConfig, getClientConfig, getSession } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import * as client from 'openid-client';
export async function GET(request: NextRequest) {
  const session = await getSession();
  const openIdClientConfig = await getClientConfig();
  const headerList = await headers();
  const host =
    headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost';
  const protocol = headerList.get('x-forwarded-proto') || 'https';
  const currentUrl = new URL(
    `${protocol}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const tokenSet = await client.authorizationCodeGrant(
    openIdClientConfig,
    currentUrl,
    {
      pkceCodeVerifier: session.code_verifier,
      expectedState: session.state,
    },
  );
  const { access_token, refresh_token, expires_in, id_token } = tokenSet;
  session.isLoggedIn = true;
  session.access_token = access_token;
  if (id_token) {
    session.id_token = id_token;
  }
  if (refresh_token) {
    session.refresh_token = refresh_token;
  }
  if (expires_in) {
    session.expires_at = Math.floor(Date.now() / 1000) + expires_in;
  }
  const claims = tokenSet.claims()!;
  const { sub } = claims;
  // call userinfo endpoint to get user info
  const userinfo = await client.fetchUserInfo(
    openIdClientConfig,
    access_token,
    sub,
  );
  session.userInfo = {
    sub: userinfo.sub,
    name: userinfo.given_name!,
    email: userinfo.email!,
    email_verified: userinfo.email_verified!,
  };

  await session.save();
  return Response.redirect(clientConfig.post_login_route);
}
