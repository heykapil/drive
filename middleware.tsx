import { betterFetch } from '@better-fetch/fetch';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Session } from './lib/auth';
import { signJWT } from './lib/helpers/jose';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/file/')) {
    return NextResponse.next();
  }
  const production = process.env.NODE_ENV === 'production';
  const secureCookie: boolean = production;
  const cookiePrefix  = secureCookie ? '__Secure-' : '';
  const session_token = request.cookies.get(`${cookiePrefix}kapil.app.session_token`)?.value || '';
  const sessionData = request.cookies.get(`${cookiePrefix}kapil.app.sessionData`)?.value || '';
  const allCookies = request.cookies.getAll();
  const bucketCookies = allCookies.filter(cookie => cookie.name.startsWith(`${cookiePrefix}bucket_`));
  const refresh_buckets: boolean = allCookies.filter(cookie => cookie.name.startsWith(`${cookiePrefix}refresh_buckets`))[0]?.value === 'true';
  const midResponse = NextResponse.next();
  if (production && !session_token) {
   return NextResponse.redirect(new URL('/login?redirectTo='+ encodeURIComponent(request.nextUrl as unknown as string), process.env.BETTER_AUTH_URL!));
  }
  if (production && session_token && !sessionData) {
    const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
      baseURL: process.env.BETTER_AUTH_URL,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    if (production && !session) {
     return NextResponse.redirect(new URL('/login?redirectTo='+ encodeURIComponent(request.nextUrl as unknown as string), process.env.BETTER_AUTH_URL!));
    }

    if (production) {
      midResponse.cookies.set({
        name: `${cookiePrefix}kapil.app.sessionData`,
        value: await signJWT(session!),
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.kapil.app' : '.localhost',
        secure: process.env.NODE_ENV === 'production' ? true : false,
        expires: new Date(Date.now() + 1000 * 60 * 5),
        path: '/',
      });
    }
  }


  if (bucketCookies.length > 0 && !refresh_buckets) {
      return midResponse;
  }

  try {
      const res = await fetch('https://kv.kapil.app/kv/list?prefix=buckets,drive.kapil.app');
      const redisbucketArray = await res.json();

      // Create a response to set cookies.
      const response = midResponse;

      // For each bucket, store the encrypted config in a separate cookie.
      redisbucketArray.forEach((item: any) => {
        const lastKeySegment = item.key[item.key.length - 1];
        response.cookies.set(`${cookiePrefix}bucket_${lastKeySegment}`, item.value, {
          maxAge: 60 * 60 * 24, // 1 day
          httpOnly: true,
          sameSite: 'lax',
          secure: production,
          path: '/',
        });
      });
      response.cookies.delete(`${cookiePrefix}refresh_buckets`)
      return response;
    } catch (error) {
      console.error('Error fetching KV:', error);
      return midResponse;
    }
}

export const config = {
  matcher: ['/:path*'],
};
