import Loading from '@/app/loading';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SharedFilesPage } from './SharedClientPage';

export default async function SharedPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/login');
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Shared Files</h1>
      <Suspense fallback={<Loading />}>
        <SharedFilesPage />
      </Suspense>
    </>
  );
}
