'use client'
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { useEffect, useState } from "react";
import { FileUpload as Upload3 } from "./FileUpload3";
import FileUploadServer from "./FileUploadServer";

export default function FileUpload() {
  const { selectedBucketId } = useBucketStore();
  const [synologyBucket, setIsSynologyBucket] = useState(false);
  useEffect(() => {
    if (selectedBucketId) {
      const bucketInfo = getBucketInfo(selectedBucketId);
      setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology' || false);
    } else {
      setIsSynologyBucket(false);
    }
  }, [selectedBucketId]);
  if (synologyBucket) {
    return <FileUploadServer />
  } else {
    return <Upload3 />
  }
}
