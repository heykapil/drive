'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload4 } from "./FileUpload4";
import RemoteUpload3 from "./RemoteUpload3";

export default function FileUpload({
  testS3ConnectionAction,
  encryptBucketConfigAction
}: {
  testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>,
  encryptBucketConfigAction: (bucketId: number) => Promise<string>
}) {
  return (
    <Tabs defaultValue="local" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="local">Local Upload</TabsTrigger>
        <TabsTrigger value="remote">Remote URL</TabsTrigger>
      </TabsList>
      <TabsContent value="local">
        <FileUpload4
          testS3ConnectionAction={testS3ConnectionAction}
          encryptBucketConfigAction={encryptBucketConfigAction}
        />
      </TabsContent>
      <TabsContent value="remote">
        <RemoteUpload3
          encryptBucketConfig={encryptBucketConfigAction}
          testS3ConnectionAction={testS3ConnectionAction}
        />
      </TabsContent>
    </Tabs>
  );
}
