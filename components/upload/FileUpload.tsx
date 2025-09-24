'use client'
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { encryptBucketConfig } from "@/service/bucket.config";
import { testS3Connection } from "@/service/s3-tebi";
import { useEffect, useState } from "react";
import { FileUpload as Upload3 } from "./FileUpload3";
import FileUploadServer from "./FileUploadServer";

export default function FileUpload({testS3ConnectionAction}: {testS3ConnectionAction: (bucketIds: number | number[])=> Promise<any>}) {
  const { selectedBucketId } = useBucketStore();
  const [synologyBucket, setIsSynologyBucket] = useState(false);
  useEffect(() => {
    if(selectedBucketId){
    const bucketInfo = getBucketInfo(selectedBucketId);
    setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology');
    }
  }, [selectedBucketId]);
  if (synologyBucket) {
    return <FileUploadServer testS3ConnectionAction={testS3Connection} encryptBucketConfigAction={encryptBucketConfig} />
  } else {
    return <Upload3 testS3ConnectionAction={testS3ConnectionAction} />
  }
}
