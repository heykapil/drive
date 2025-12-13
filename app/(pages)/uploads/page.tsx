import Loading from '@/app/loading';
export const dynamic = 'force-dynamic';
import FileList from '@/components/data/FileList2';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/api/login');
  }
  const bucketId = (await searchParams)?.bucketId;
  return (
    <>
      <h1 className="text-2xl font-bold px-1">My files</h1>
      <Suspense fallback={<Loading />}>
        <FileList bucketId={parseInt(bucketId, 10)} />
      </Suspense>
    </>
  );
}
