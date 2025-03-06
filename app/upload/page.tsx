import FileUpload from "@/components/FileUpload2";
import HeaderNav from "@/components/header-nav";
import { Suspense } from "react";
export default async function UploadPage() {
  return (
    <Suspense>
    <HeaderNav />
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
    <div className="md:2xl lg:w-4xl mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold lg:px-4">Upload files</h1>
      <FileUpload  />
    </div>
    </main>
    </div>
    </Suspense>
  );
}
