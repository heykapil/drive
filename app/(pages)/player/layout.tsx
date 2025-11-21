import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';

export default async function PlayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && session?.user?.username !== 'admin') {
    return notFound();
  }
  return { children };
}
