import FileList2 from "@/components/FileList2";
import HeaderNav from "@/components/header-nav";
import { Suspense } from "react";

export default async function HistoryPage() {
  return (
    <Suspense>
    <HeaderNav />
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
    <div className="w-full md:w-2xl lg:w-4xl mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold px-4">My files</h1>
      {/* <FileUpload  /> */}
      <FileList2 />
    </div>
    </main>
    </div>
    </Suspense>
  );
}
