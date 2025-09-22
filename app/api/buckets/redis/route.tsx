import { generateStateToken } from "@/lib/actions";
import { betterFetch } from "@better-fetch/fetch";
import { NextResponse } from "next/server";

export async function POST() {
  const production = process.env.NODE_ENV === 'production';
  const cookiePrefix = production ? '__Secure-' : '';

  try {
    const { state, token } = await generateStateToken();
    const {data, error} = await betterFetch<{key: string[], value: string, versionstamp:string}[]>(`https://kv.kapil.app/kv/list?prefix=buckets,drive.kapil.app&state=${state}&token=${token}`);
    if(!data|| error) throw new Error('Failed to fetch buckets');
    const response = NextResponse.json(data, {status: 200});
    data.forEach((item: any) => {
      const lastKeySegment = item.key[item.key.length - 1];
      response.cookies.set(`${cookiePrefix}bucket_${lastKeySegment}`, item.value, {
        maxAge: 60 * 60 * 24, // Cookie valid for 1 day.
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        path: '/',
      });
    });

    // Delete the refresh bucket cookie.
    response.cookies.delete(`${cookiePrefix}refresh_buckets`);

    return response;
  } catch (error) {
    console.error('Error fetching KV:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to fetch buckets'
    });
  }
}
