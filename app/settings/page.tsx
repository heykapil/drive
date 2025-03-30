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
      <>
          <h1 className="text-2xl font-bold">Settings</h1>
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
            <SettingsContent />
          </Suspense>
      </>
  );
}
