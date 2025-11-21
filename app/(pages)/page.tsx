import DashboardPage, {
  DashboardSkeleton,
} from '@/components/data/DashboardPage';
import { Button } from '@/components/ui/button';
import { deleteSession } from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';
export default async function Dashboard() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if (production && session?.user?.username !== 'admin') {
    return (
      <div>
        <h2 className="animate-fade-right text-2xl font-semibold">
          Not Authorized!
        </h2>
        You are logged in as {session?.user?.username}. Please login with admin
        role to continue. <br />
        <Button
          onClick={() => {
            toast.promise(deleteSession, {
              loading: 'Logging out...',
              success: 'Logged out successfully!',
              error: 'Error logging out.',
            });
            toast.promise(
              redirect(
                process.env.BETTER_AUTH_URL +
                  '/login?redirectTo=' +
                  process.env.NEXT_PUBLIC_APP_URL,
              ),
              {
                loading: 'Redirecting to login...',
                success: 'Redirected to login!',
                error: 'Error redirecting to login.',
              },
            );
          }}
        >
          Logout
        </Button>
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
