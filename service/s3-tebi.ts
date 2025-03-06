'use server'
import { HeadBucketCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { cookies } from 'next/headers';
import { BucketConfig, buckets } from './bucket.config';

export async function s3BucketSyncError({ bucket }: {bucket: string}){
  const cookieStore = await cookies();
  const secureCookie: boolean = process.env.BETTER_AUTH_URL?.startsWith('https://') || false;
  const cookiePrefix  = secureCookie ? '__Secure-' : '';
  const selectedBucket =  cookieStore.get(cookiePrefix+'s3-bucket')?.value || 'default'
  if (selectedBucket === bucket) {
    return false;
  } else{
    return true;
  }
}

export async function s3() {
  const cookieStore = await cookies();
  const secureCookie: boolean = process.env.BETTER_AUTH_URL?.startsWith('https://') || false;
  const cookiePrefix  = secureCookie ? '__Secure-' : '';
  const selectedBucket =  cookieStore.get(cookiePrefix+'s3-bucket')?.value || 'default'
  const bucketConfig = buckets[selectedBucket] ?? buckets.default
  return new S3Client({
    region: 'auto',
    endpoint: bucketConfig.endpoint,
    credentials: {
      accessKeyId: bucketConfig.accessKey,
      secretAccessKey: bucketConfig.secretKey,
    },
    forcePathStyle: true,
  });
}

export async function s3WithConfig(bucketConfig: BucketConfig) {
  return new S3Client({
    region: bucketConfig.region || 'auto',
    endpoint: bucketConfig.endpoint,
    credentials: {
      accessKeyId: bucketConfig.accessKey,
      secretAccessKey: bucketConfig.secretKey,
    },
    forcePathStyle: true,
  });
}

export async function testS3Connections() {
  const results = [];

  for (const [name, config] of Object.entries(buckets)) {
    try {
      const s3 = await s3WithConfig(config);
      await s3.send(new ListBucketsCommand({}));
      results.push({ bucket: name, status: 'Success' });
    } catch (error: any) {
      results.push({ bucket: name, status: 'Error', message: error.message });
    }
  }
  return results;
}

const MAX_BUCKET_CAPACITY_GB = 25; // 25GB limit
const MAX_BUCKET_CAPACITY_BYTES = MAX_BUCKET_CAPACITY_GB * 1024 * 1024 * 1024; // Convert to bytes

export async function getS3StorageUsage() {
  const results = [];

  for (const [name, config] of Object.entries(buckets)) {
    try {
      const s3 = await s3WithConfig(config);

      // Check if the bucket exists
      await s3.send(new HeadBucketCommand({ Bucket: config.name }));

      let totalSize = 0;
      let continuationToken: string | undefined = undefined;

      do {
        const response: any = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.name,
            ContinuationToken: continuationToken,
          })
        );

        totalSize += response.Contents?.reduce((sum: number, obj: any) => +sum + (obj.Size || 0), 0) || 0;
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      // Calculate available storage
      const availableStorageBytes = Math.max(MAX_BUCKET_CAPACITY_BYTES - totalSize, 0);
      const availableStorageGB = (availableStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

      results.push({
        bucket: name,
        status: "Success",
        storageUsed: totalSize,
        storageUsedMB: (totalSize / (1024 * 1024)).toFixed(2) + " MB",
        storageUsedGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2) + " GB",
        availableCapacityGB: availableStorageGB + " GB",
      });
    } catch (error: any) {
      results.push({
        bucket: name,
        status: "Error",
        message: error.message,
      });
    }
  }

  return results;
}
