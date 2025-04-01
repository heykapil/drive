import  FileList  from "@/components/data/FileList2";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "../loading";

export default async function UploadsPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if(production && session?.user?.username !== 'admin'){
    return notFound()
  }
  return (
    <>
      <h1 className="text-2xl font-bold px-1">My files</h1>
      <Suspense fallback={<Loading />}>
        <FileList />
      </Suspense>
    </>
  );
}
