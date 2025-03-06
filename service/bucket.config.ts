// app/s3-dashboard/buckets.config.ts
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint?: string
}

export const buckets: Record<string, BucketConfig> = {
  'default': {
    name: 'cdn.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'photos': {
    name: 'photos.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'docs': {
    name: 'docs.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_4 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_4 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'notes': {
    name: 'notes.kapil.app',
    accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  },
  'archives' : {
    name: 'archives',
    accessKey: process.env.AWS_ACCESS_KEY_ID_2 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_2 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT
  },
  'videos': {
    name: 'terabox',
    accessKey: process.env.AWS_ACCESS_KEY_ID_3 as string,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY_3 as string,
    region: process.env.AWS_REGION as string,
    endpoint: process.env.AWS_ENDPOINT as string,
  }
}
