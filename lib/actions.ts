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
