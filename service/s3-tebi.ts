'use server'
import { HeadBucketCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { cookies } from 'next/headers';
import { BucketConfig, getallBuckets } from './bucket.config';
import { toast } from "sonner";


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
  const buckets = await getallBuckets();
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
  const buckets = await getallBuckets();
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

const DEFAULT_MAX_BUCKET_CAPACITY_GB = 25; // 25GB limit

export async function getS3StorageUsage() {
  const results = [];

  const buckets = await getallBuckets();
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
     ; // Convert to bytes

      const TotalAvailableSizeGB = config.availableCapacity || DEFAULT_MAX_BUCKET_CAPACITY_GB;
      const TotalAvailableSizeBytes = TotalAvailableSizeGB * 1024 * 1024 * 1024;
      const availableStorageBytes = Math.max(TotalAvailableSizeBytes - totalSize, 0);
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

export async function getBucketStorageUsage(bucketName: string) {
  const buckets = await getallBuckets();
  const config = buckets[bucketName];
  if (!config) {
    throw new Error("Invalid bucket");
  }

  try {
    const s3 = await s3WithConfig(config);
    // Check if the bucket exists.
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
      totalSize += response.Contents?.reduce((sum: number, obj: any) => sum + (obj.Size || 0), 0) || 0;
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const totalAvailableSizeGB = config.availableCapacity || DEFAULT_MAX_BUCKET_CAPACITY_GB;
    const totalAvailableSizeBytes = totalAvailableSizeGB * 1024 * 1024 * 1024;
    const availableStorageBytes = Math.max(totalAvailableSizeBytes - totalSize, 0);
    const availableStorageGB = (availableStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    return {
      bucket: bucketName,
      status: "Success",
      storageUsed: totalSize,
      storageUsedMB: (totalSize / (1024 * 1024)).toFixed(2) + " MB",
      storageUsedGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2) + " GB",
      availableCapacityGB: availableStorageGB + " GB",
    };
  } catch (error: any) {
    return {
      bucket: bucketName,
      status: "Error",
      message: error.message,
    };
  }
}

export async function getSingleBucketStorageUsage(bucketId: string) {
  const buckets = await getallBuckets();
  const config = buckets[bucketId];
  if (!config) {
    throw new Error("Invalid bucket");
  }

  try {
    const s3 = await s3WithConfig(config);
    // Check if the bucket exists.
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
      totalSize += response.Contents?.reduce((sum: number, obj: any) => sum + (obj.Size || 0), 0) || 0;
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const totalAvailableSizeGB = config.availableCapacity || DEFAULT_MAX_BUCKET_CAPACITY_GB;
    const totalAvailableSizeBytes = totalAvailableSizeGB * 1024 * 1024 * 1024;
    const availableStorageBytes = Math.max(totalAvailableSizeBytes - totalSize, 0);
    const availableStorageGB = (availableStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    return {
      bucket: bucketId,
      status: "Success",
      storageUsed: +totalSize,
      storageUsedMB: +(totalSize / (1024 * 1024)).toFixed(2),
      storageUsedGB: +(totalSize / (1024 * 1024 * 1024)).toFixed(2),
      availableCapacityGB: +availableStorageGB,
      totalStorage: +availableStorageGB + +(totalSize / (1024 * 1024 * 1024)).toFixed(2)
    };
  } catch (error: any) {
    return {
      bucket: bucketId,
      status: "Error",
      message: error.message,
    };
  }
}


export async function verifyBucketConnection(bucketConfig: BucketConfig): Promise<boolean> {
  const s3Client = await s3WithConfig(bucketConfig);
  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: bucketConfig.name,
      })
    );
    return true;
  } catch (error) {
    toast.error('Bucket connection verification failed:', { description: JSON.stringify(error)});
    return false;
  } finally {
    s3Client.destroy();
  }
}
