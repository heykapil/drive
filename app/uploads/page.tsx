import FileList from "@/components/data/FileList2";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "../loading";

export default async function HistoryPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if(production && session?.user?.username !== 'admin'){
    return notFound()
  }
  return (
  <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
    <div className="w-[100vw] md:w-2xl lg:w-4xl mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold px-4">My files</h1>
      <Suspense fallback={<Loading />}>
        <FileList />
      </Suspense>
    </div>
    </main>
    </div>
  );
}
