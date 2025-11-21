import DashboardPage, {
  DashboardSkeleton,
} from '@/components/data/DashboardPage';
import { getSession } from '@/lib/auth';
import { Suspense } from 'react';
export default async function Dashboard() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && session?.user?.username !== 'admin') {
    return (
      <div>
        <h2 className="animate-fade-right text-2xl font-semibold">
          Not Authorized!
        </h2>
        You are logged in as {session?.user?.username}. Please{' '}
        <a href="/logout?callbackUrl=/">login with admin role</a> to
        continue.{' '}
      </div>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold lg:px-4">Dashboard</h1>
      <Suspense
        fallback={<DashboardSkeleton />}
        // key="dashboard-content"
      >
        <DashboardPage />
      </Suspense>
    </>
  );
}
