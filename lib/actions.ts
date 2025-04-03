'use server';
import { testDBConnection } from '@/service/postgres';
import { testS3Connections } from '@/service/s3-tebi';

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

export async function ytDlp(inputUrl: any) {
  try {
    const response = await fetch(process.env.YTDLP_LAMBDA_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.YTDLP_LAMBDA_API_KEY as string,
      },
      body: JSON.stringify({ urls: [inputUrl], extraOptions: [], cookies: '' })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
