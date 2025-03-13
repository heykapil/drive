'use server';
import { testDBConnection } from '@/service/postgres';
import { testS3Connections } from '@/service/s3-tebi';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';


export async function testSystemHealth() {
  const storageErrors = await testS3Connections();
  const postgresErrors = await testDBConnection();

  return {
    storageErrors: storageErrors.filter(res => res.status === 'Error'),
    postgresErrors: postgresErrors
      ? Object.entries(postgresErrors)
          .filter(([_, res]) => res.status === 'Error')
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      : null,
  };
}

export async function setBucketCookie(bucketName: string, path: string) {
  const { storageErrors } = await testSystemHealth();
  const errorBucket = storageErrors.find(err => err.bucket === bucketName);
  if (errorBucket) {
    throw new Error(`Bucket ${bucketName} has an error: ${errorBucket.message}`);
  } else {
    const cookieStore = await cookies();
    const secureCookie: boolean = process.env.BETTER_AUTH_URL?.startsWith('https://') || false;
    const cookiePrefix = secureCookie ? '__Secure-' : '';
    cookieStore.set({
      name: cookiePrefix + 's3-bucket',
      value: bucketName,
      sameSite: true,
      httpOnly: true,
      secure: secureCookie,
      path: '/',
      expires: new Date(Date.now() + 1000*60*60*24),
    })
  }
  revalidatePath(path);
}
