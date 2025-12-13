import DashboardPage, {
  DashboardSkeleton,
} from '@/components/data/DashboardPage';
import { getSession } from '@/lib/auth';
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
