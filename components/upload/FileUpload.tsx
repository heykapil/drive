'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload5 } from "./FileUpload5";
import RemoteUpload4 from "./RemoteUpload4";

export default function FileUpload({
  testS3ConnectionAction
}: {
  testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>

}) {
  return (
    <Tabs defaultValue="local" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="local">Local Upload</TabsTrigger>
        <TabsTrigger value="remote">Remote URL</TabsTrigger>
      </TabsList>
      <TabsContent value="local">
        <FileUpload5
          testS3ConnectionAction={testS3ConnectionAction}
        />
      </TabsContent>
      <TabsContent value="remote">
        <RemoteUpload4 />
      </TabsContent>
    </Tabs>
  );
}
