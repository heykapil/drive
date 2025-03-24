import { DashboardSkeleton } from "@/components/data/DashboardPage";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import DashboardPage from '@/components/data/DashboardPage';

export default async function Dashboard() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();

  if(production && session?.user?.username !== 'admin'){
    return notFound();
  }

  return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
          <div className="w-[93vw] md:2xl lg:w-4xl mx-auto py-6 space-y-6">
            <h1 className="text-2xl font-bold lg:px-4">Dashboard</h1>
            <Suspense
              fallback={<DashboardSkeleton />}
              // key="dashboard-content"
            >
              <DashboardPage />
            </Suspense>
          </div>
        </main>
      </div>
  );
}
