import Loading from '@/app/loading';
import RemoteUploadForm from '@/components/upload/RemoteUpload2';
import { getSession } from '@/lib/auth';
import { encryptBucketConfig } from '@/service/bucket.config';
import { testS3Connection } from '@/service/s3-tebi';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
export default async function Dashboard() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/login');
  }
  return (
    <>
      <h1 className="text-2xl font-bold lg:px-4">Remote uploads</h1>
      <Suspense fallback={<Loading />}>
        <RemoteUploadForm
          encryptBucketConfigAction={encryptBucketConfig}
          testS3ConnectionAction={testS3Connection}
        />
      </Suspense>
    </>
  );
}
