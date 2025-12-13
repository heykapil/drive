import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function BucketLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && !session.isLoggedIn) {
    return redirect('/login');
  }
  return <>{children}</>;
}
