'use server';
import { BucketConfig } from '@/service/bucket.config';
import { JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { Payload } from 'paseto-ts/lib/types';
import { decryptJWT, encryptJWT } from './helpers/jose';
import { signPasetoToken } from './helpers/paseto-ts';
import { generateRandomUUID } from './helpers/uuid';

// export async function testSystemHealth() {
//   const storageErrors = await testS3Connections();
//   const postgresErrors = await testDBConnection();

//   return {
//     storageErrors: storageErrors.filter(res => res.status === 'Error'),
//     postgresErrors: postgresErrors
//       ? Object.entries(postgresErrors)
//           .filter(([_, res]) => res.status === 'Error')
//           .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
//       : null,
//   };
// }

export async function ytDlp(inputUrl: any) {
  try {
    const response = await fetch(process.env.YTDLP_LAMBDA_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.YTDLP_LAMBDA_API_KEY as string,
      },
      body: JSON.stringify({ urls: [inputUrl], extraOptions: [], cookies: '' }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addredisBucket(id: string, bucketConfig: BucketConfig) {
  try {
    const state = generateRandomUUID();
    const payload = { state };
    const token = await signPasetoToken(payload);
    const response = await fetch(
      `https://kv.kapil.app/kv?key=buckets,drive.kapil.app,${id}&state=${state}`,
      {
        method: 'POST',
        body: JSON.stringify(await encryptJWT({ bucketConfig } as JWTPayload)),
        headers: {
          Authorization: `Bearer v4.public.${token}`,
        },
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteredisBucket(id: string) {
  try {
    const state = generateRandomUUID();
    const payload = { state };
    const token = await signPasetoToken(payload);
    const response = await fetch(
      `https://kv.kapil.app/kv?key=buckets,drive.kapil.app,${id}&state=${state}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer v4.public.${token}`,
        },
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getredisBucket(id: string) {
  try {
    const { state, token } = await generateStateToken();
    const response = await fetch(
      `https://kv.kapil.app/kv?key=buckets,drive.kapil.app,${id}&state=${state}&token=${token}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer v4.public.${token}`,
        },
      },
    );
    const data = await response.json();
    const bucket = await decryptJWT(data.value);
    return bucket as unknown as BucketConfig;
  } catch (error) {
    throw error;
  }
}

export async function generateStateToken() {
  const state = generateRandomUUID();
  const payload = { state };
  const hash = await signPasetoToken(payload as Payload);
  if (!hash) {
    throw new Error('Failed to generate state token');
  } else {
    return { state, token: `v4.public.${hash}` };
  }
}

export async function addPostgresBucket(
  id: number,
  bucketConfig: BucketConfig,
) {
  try {
    const state = generateRandomUUID();
    const payload = { state };
    const token = await signPasetoToken(payload);
    const response = await fetch(
      `https://kv.kapil.app/kv?key=buckets,drive.kapil.app,${id}&state=${state}`,
      {
        method: 'POST',
        body: JSON.stringify(await encryptJWT({ bucketConfig } as JWTPayload)),
        headers: {
          Authorization: `Bearer v4.public.${token}`,
        },
      },
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const production = process.env.NODE_ENV === 'production';
  const secureCookie: boolean = production;
  const cookiePrefix = secureCookie ? '__Secure-' : '';
  try {
    cookieStore.delete(`${cookiePrefix}kapil.app.session_token`);
    cookieStore.delete(`${cookiePrefix}kapil.app.sessionData`);
    cookieStore.delete(`${cookiePrefix}kapil.app.session_data`);
  } catch (error) {
    console.error('Error deleting cookies:', error);
  }
}
