// app/s3-dashboard/buckets.config.ts
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint?: string
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
    cdnUrl: 'https://photos.kapil.app'
  },
  'docs': {
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
    cdnUrl: 'https://notes.kapil.app'
  },
  'archives' : {
    name: 'archives',
    accessKey: process.env.AWS_ACCESS_KEY_ID_2 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_2 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT,
    cdnUrl: 'https://archives.kapil.app'
  },
  'videos': {
    name: 'terabox',
    accessKey: process.env.AWS_ACCESS_KEY_ID_3 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_3 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
    cdnUrl: 'https://videos.kapil.app/terabox'
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
