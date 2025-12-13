import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DiffPage from './client';

export default async function DiffMainPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/login');
  }
  return <DiffPage />;
}
