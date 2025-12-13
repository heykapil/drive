import Loading from '@/app/loading';
import FileUpload from '@/components/upload/FileUpload';
import { getSession } from '@/lib/auth';
import { encryptBucketConfig } from '@/service/bucket.config';
import { testS3Connection } from '@/service/s3-tebi';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export default async function UploadPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/login');
  }
  return (
    <>
      <h1 className="text-2xl font-bold lg:px-4">Upload files</h1>
      <Suspense fallback={<Loading />}>
        {/* {production ? <FileUpload /> : <FileUploadServer />} */}
        <FileUpload
          testS3ConnectionAction={testS3Connection}
          encryptBucketConfigAction={encryptBucketConfig}
        />
      </Suspense>
    </>
  );
}
