// app/s3-dashboard/buckets.config.ts
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint: string
  availableCapacity?: number
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
  },
  'photos': {
    name: 'photos.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://photos.kapil.app',
    availableCapacity: 12,
  },
  'documents': {
    name: 'docs.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_4 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_4 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://docs.kapil.app'
  },
  'notes': {
    name: 'notes.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    availableCapacity: 12,
    cdnUrl: 'https://notes.kapil.app'
  },
  'archives' : {
    name: 'archives',
    accessKey: process.env.AWS_ACCESS_KEY_ID_2 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_2 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'videos': {
    name: 'terabox',
    accessKey: process.env.AWS_ACCESS_KEY_ID_3 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_3 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'videos 2': {
    name: 'elle',
    accessKey: process.env.AWS_ACCESS_KEY_ID_5 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_5 as string,
    region: process.env.AWS_REGION_5 as string,
    endpoint: process.env.AWS_ENDPOINT_5 as string,
    availableCapacity: 15,
  },
  'videos 3': {
    name: 'kap',
    accessKey: process.env.AWS_ACCESS_KEY_ID_6 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_6 as string,
    region: process.env.AWS_REGION_6 as string,
    endpoint: process.env.AWS_ENDPOINT_6 as string,
    availableCapacity: 15,
  },
  'videos 4': {
    name: 'kch',
    accessKey: process.env.AWS_ACCESS_KEY_ID_7 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_7 as string,
    region: process.env.AWS_REGION_7 as string,
    endpoint: process.env.AWS_ENDPOINT_7 as string,
    availableCapacity: 15,
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

export const bucketOptions = Object.keys(buckets).map((key) => ({
  value: key,
  label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
}));
