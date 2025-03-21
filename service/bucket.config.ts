// app/s3-dashboard/buckets.config.ts
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint: string
  availableCapacity?: number
  private?: boolean
  cdnUrl?: string
}

export const buckets: Record<string, BucketConfig> = {
  'default': {
    name: 'cdn.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://cdn.kapil.app',
    private: false,
  },
  'photos': {
    name: 'photos.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://photos.kapil.app',
    availableCapacity: 12,
    private: false,
  },
  'documents': {
    name: 'docs.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_4 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_4 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://docs.kapil.app',
    private: false,
  },
  'notes': {
    name: 'notes.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    availableCapacity: 12,
    cdnUrl: 'https://notes.kapil.app',
    private: false,
  },
  'archives' : {
    name: 'archives',
    accessKey: process.env.AWS_ACCESS_KEY_ID_2 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_2 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    private: true,
  },
  'videos': {
    name: 'terabox',
    accessKey: process.env.AWS_ACCESS_KEY_ID_3 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_3 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    private: true,
  },
  'videos 2': {
    name: 'elle',
    accessKey: process.env.AWS_ACCESS_KEY_ID_5 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_5 as string,
    region: process.env.AWS_REGION_5 as string,
    endpoint: process.env.AWS_ENDPOINT_5 as string,
    availableCapacity: 15,
    private: true,
  },
  'videos 3': {
    name: 'kap',
    accessKey: process.env.AWS_ACCESS_KEY_ID_6 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_6 as string,
    region: process.env.AWS_REGION_6 as string,
    endpoint: process.env.AWS_ENDPOINT_6 as string,
    availableCapacity: 15,
    private: true,
  },
  'videos 4': {
    name: 'kch',
    accessKey: process.env.AWS_ACCESS_KEY_ID_7 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_7 as string,
    region: process.env.AWS_REGION_7 as string,
    endpoint: process.env.AWS_ENDPOINT_7 as string,
    availableCapacity: 15,
    private: true,
  },
  'videos 5': {
    name: 'tbox',
    accessKey: process.env.AWS_ACCESS_KEY_ID_8 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_8 as string,
    region: process.env.AWS_REGION_8 as string,
    endpoint: process.env.AWS_ENDPOINT_8 as string,
    availableCapacity: 15,
    private: true,
  },
  'videos 6': {
    name: 'tbox2',
    accessKey: process.env.AWS_ACCESS_KEY_ID_9 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_9 as string,
    region: process.env.AWS_REGION_9 as string,
    endpoint: process.env.AWS_ENDPOINT_9 as string,
    availableCapacity: 15,
    private: true,
  }
}

export function replaceS3WithCDN(bucket: string, s3Url: string): string {
  const bucketConfig = buckets[bucket];

  if (!bucketConfig.cdnUrl) {
    console.warn(`Bucket "${bucket}" not found.`);
    return s3Url;
  }

  try {
    const url = new URL(s3Url);

    if (!url.origin.startsWith('https://s3.tebi.io') || !url.pathname.startsWith(`/${bucketConfig.name}/`)) {
      console.warn(`S3 URL does not match the expected bucket structure: ${s3Url}`);
      return s3Url;
    }

    // Extract the object path (remove "/bucket" from pathname)
    const objectPath = url.pathname.replace(`/${bucketConfig.name}`, "");

    // Construct the new URL using the cdnUrl
    //
    const finalUrl = `${bucketConfig.cdnUrl}${objectPath}${url.search}`
    return finalUrl;
  } catch (error) {
    console.error(`Invalid S3 URL: ${s3Url}`, error);
    return s3Url;
  }
}

export function getBucketConfig(bucket: string) {
  const bucketConfig = buckets[bucket];

  if (!bucketConfig) {
    throw new Error(`Bucket "${bucket}" not found.`);
  }

  return bucketConfig;
}

export function getbucketId(bucket: string) {
  try {
    const bucketId = Object.keys(buckets).find(
      (key) => buckets[key].name === bucket
    )
    return bucketId
  } catch (error) {
    console.error(error);
    throw new Error("Failed to get bucket id!")
  }
}

export const getPublicBuckets = (): BucketConfig[] => {
  return Object.values(buckets).filter((bucket) => bucket.private === false);
};

export const publicbucketOptions = Object.entries(buckets)
  .filter(([_, bucket]) => bucket.private === false) // Filter only public buckets
  .map(([key]) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
  }));

export const privatebucketOptions = Object.entries(buckets)
  .filter(([_, bucket]) => bucket.private === true) // Filter only public buckets
  .map(([key]) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
  }));

export const bucketOptions = Object.entries(buckets)
  .map(([key]) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
  }));
