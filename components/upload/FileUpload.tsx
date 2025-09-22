'use client'
import { useBucketStore } from "@/hooks/use-bucket-store";
import { getBucketConfig } from "@/service/bucket.config";
import { useEffect, useState } from "react";
import { FileUpload as Upload3 } from "./FileUpload3";
import FileUploadServer from "./FileUploadServer";

export default function FileUpload() {
  const { selectedBucketId } = useBucketStore();
  const [synologyBucket, setIsSynologyBucket] = useState(false);
  useEffect(() => {
    async function setSynologyBucket(){
      const config = await getBucketConfig(selectedBucketId as number)
    setIsSynologyBucket(config[0]?.provider?.includes('synology') || false);
  }
  setSynologyBucket();
},[selectedBucketId])
  if (synologyBucket) {
    return <FileUploadServer />
  } else {
    return <Upload3 />
  }
}
