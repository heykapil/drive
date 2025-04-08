'use client'
import { useBucketStore } from "@/hooks/use-bucket-store";
import { FileUpload as Upload3 } from "./FileUpload3";
import FileUploadServer from "./FileUploadServer";
import { getBucketConfig } from "@/service/bucket.config";
import { useEffect, useState } from "react";

export default function FileUpload() {
  const { selectedBucket } = useBucketStore();
  const [synologyBucket, setIsSynologyBucket] = useState(false);
  useEffect(() => {
    async function setSynologyBucket(){
      const config = await getBucketConfig(selectedBucket)
    setIsSynologyBucket(config?.provider?.includes('synology') || false);
  }
  setSynologyBucket();
},[selectedBucket])
  if (synologyBucket) {
    return <FileUploadServer />
  } else {
    return <Upload3 />
  }
}
