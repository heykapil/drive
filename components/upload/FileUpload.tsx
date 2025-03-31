'use client'
import { useBucketStore } from "@/hooks/use-bucket-store";
import { FileUpload as Upload3 } from "./FileUpload3";
import FileUploadServer from "./FileUploadServer";
import { getBucketConfig } from "@/service/bucket.config";
import { useEffect, useState } from "react";

export default function FileUpload() {
  const { selectedBucket } = useBucketStore();
  const[synologyBucket,setIsSynologyBucket] = useState(false);
  // const production = process.env.NODE_ENV === 'production';
  useEffect(()=>{
    setIsSynologyBucket(getBucketConfig(selectedBucket)?.provider?.includes('synology') || false);
  },[selectedBucket])
  if (synologyBucket) {
    return <FileUploadServer />
  } else {
    return <Upload3 />
  }
}
