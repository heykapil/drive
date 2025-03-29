import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SettingsContent from "./ClientSettings";

export default async function SettingsPage() {
  const production = process.env.NODE_ENV === 'production';
   const session = await getSession();
   if(production && session?.user?.username !== 'admin'){
     return notFound()
   }
  return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2">
        <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
          <div className="w-[95vw] md:w-2xl lg:w-4xl mx-auto py-6 px-2 md:px-0 space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
              <SettingsContent />
            </Suspense>
          </div>
        </main>
      </div>
  );
}
