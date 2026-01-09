import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import {
    sessionOptions,
    SessionData,
    clientConfig,
} from './lib/auth-config';
import * as client from 'openid-client';
import { cookies } from 'next/headers';
import { createNewSession, refreshSession } from './lib/edge-session';

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(
        request,
        response,
        sessionOptions
    );
    const production = process.env.NODE_ENV === 'production';
    const path = request.nextUrl.pathname;

    // Public paths that don't require authentication
    const isPublic =
        path === '/login' ||
        path.startsWith('/oidc') ||
        path.startsWith('/_next') ||
        path.startsWith('/static') ||
        path.includes('.'); // File extensions like .png, .ico, etc.

    // 1. Global Auth Guard
    if (production && !session.isLoggedIn && !isPublic) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. Token Refresh Logic
    if (production && session.isLoggedIn && session.expires_at && session.refresh_token) {
        const expiresAtMs = session.expires_at * 1000;
        const refreshThreshold = expiresAtMs - (5 * 60 * 1000); // 5 minutes before expiry
        const now = Date.now();

        if (now >= refreshThreshold) {
            console.log('[Middleware] Token close to expiry, refreshing...');
            try {
                const issuer = await client.discovery(
                    new URL(clientConfig.url!),
                    clientConfig.client_id!
                );

                const tokenSet = await client.refreshTokenGrant(
                    issuer,
                    session.refresh_token
                );

                console.log('[Middleware] Token refresh success');
                session.access_token = tokenSet.access_token;
                if (tokenSet.refresh_token) {
                    session.refresh_token = tokenSet.refresh_token;
                }
                if (tokenSet.expires_in) {
                    session.expires_at = Math.floor(Date.now() / 1000) + tokenSet.expires_in;
                }
                await session.save();
            } catch (error: any) {
                console.error('[Middleware] Failed to refresh token:', error);

                // If refresh fails, force logout and redirect
                const redirectRes = NextResponse.redirect(new URL('/login', request.url));
                const sessionToDestroy = await getIronSession<SessionData>(
                    request,
                    redirectRes,
                    sessionOptions
                );
                sessionToDestroy.destroy();
                await sessionToDestroy.save();

                return redirectRes;
            }
        }
    }

    const cookieStore = await cookies();
    const apiSession = cookieStore.get('session')?.value;
    const expiryCookie = cookieStore.get('session-expiry')?.value;
    const domain = process.env.NODE_ENV === 'development' ? undefined : '.kapil.app';
    const secure = process.env.NODE_ENV !== 'development';

    if (!apiSession || !expiryCookie) {
        try {
            const apiResponse = await createNewSession(session);
            const json = await apiResponse.json();

            response.cookies.set('session', json.data.session, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 60 * 60,
                secure,
                domain,
            });
            // Set expiry cookie (non-httpOnly so client can read it)
            const expiryTimestamp = Date.now() + (3600 * 1000);
            response.cookies.set('session-expiry', expiryTimestamp.toString(), {
                httpOnly: false,
                sameSite: 'lax',
                maxAge: 60 * 60,
                secure,
                domain,
            });
        } catch (error) {
            console.log(error)
        }
    } else {
        const expiresAt = parseInt(expiryCookie, 10);
        const timeRemaining = expiresAt - Date.now();
        if (timeRemaining < 10 * 60 * 1000) {
            try {
                const apiResponse = await refreshSession();
                const json = await apiResponse.json();

                response.cookies.set('session', json.data.session, {
                    httpOnly: true,
                    sameSite: 'lax',
                    maxAge: 60 * 60,
                    secure,
                    domain,
                });
                // Set expiry cookie
                const expiryTimestamp = Date.now() + (3600 * 1000);
                response.cookies.set('session-expiry', expiryTimestamp.toString(), {
                    httpOnly: false,
                    sameSite: 'lax',
                    maxAge: 60 * 60,
                    secure,
                    domain,
                });
            } catch (error) {
                console.log(error)
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
