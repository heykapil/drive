
import MoveBucketClient from './MoveBucketClient';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MoveBucketPage() {
  const session = await getSession();
  if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
    redirect('/login');
  }
  return <MoveBucketClient />;
}
