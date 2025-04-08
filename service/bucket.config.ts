'use server'
import { decryptJWT } from "@/lib/helpers/jose"
import { cookies } from "next/headers"
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint: string
  availableCapacity?: number
  private?: boolean
  cdnUrl?: string
  provider?: string
}

export async function getallPublicPrivateBuckets() {
  const redisbucketArray = await getRedisBucketArrayCookies();
  const bucketsEntries = await Promise.all(
    redisbucketArray.map(async (item: any) => {
      const lastKeySegment = item.key[item.key.length - 1];
      const config = await decryptJWT(item.value)
      return [lastKeySegment, config.bucketConfig] as [string, BucketConfig];
    })
  );
  const redisbuckets: Record<string, BucketConfig> = Object.fromEntries(bucketsEntries);
  const buckets = {...redisbuckets}
  return buckets;
}

export async function getallBuckets() {
  const buckets = await getallPublicPrivateBuckets();
  const publicBuckets = Object.entries(buckets)
    .filter(([_, config]) => !config.private)
    .reduce((acc, [key, config]) => ({ ...acc, [key]: config }), {} as Record<string, BucketConfig>);
  return publicBuckets;
}

export async function getallPrivateBuckets() {
  const buckets = await getallPublicPrivateBuckets();
  const privateBuckets = Object.entries(buckets)
    .filter(([_, config]) => config.private === true)
    .reduce((acc, [key, config]) => ({ ...acc, [key]: config }), {} as Record<string, BucketConfig>);
  return privateBuckets;
}







// const envbuckets: Record<string, BucketConfig> = {
//   'default': {
//     name: 'cdn.kapil.app',
//     accessKey: process.env.AWS_ACCESS_KEY_ID as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     cdnUrl: 'https://cdn.kapil.app',
//     private: false,
//     provider: 'tebi'
//   },
//   'photos': {
//     name: 'photos.kapil.app',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     cdnUrl: 'https://photos.kapil.app',
//     availableCapacity: 12,
//     private: false,
//     provider: 'tebi'
//   },
//   'documents': {
//     name: 'docs.kapil.app',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_4 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_4 as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     cdnUrl: 'https://docs.kapil.app',
//     private: false,
//     provider: 'tebi'
//   },
//   'notes': {
//     name: 'notes.kapil.app',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_1 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_1 as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     availableCapacity: 12,
//     cdnUrl: 'https://notes.kapil.app',
//     private: false,
//     provider: 'tebi'
//   },
//   'archives' : {
//     name: 'archives',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_2 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_2 as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     private: true,
//     provider: 'tebi'
//   },
//   'videos': {
//     name: 'terabox',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_3 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_3 as string,
//     region: process.env.AWS_REGION as string,
//     endpoint: process.env.AWS_ENDPOINT as string,
//     private: true,
//     provider: 'tebi'
//   },
//   'videos 2': {
//     name: 'elle',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_5 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_5 as string,
//     region: process.env.AWS_REGION_5 as string,
//     endpoint: process.env.AWS_ENDPOINT_5 as string,
//     availableCapacity: 15,
//     private: true,
//     provider: 'synology'
//   },
//   'videos 3': {
//     name: 'kap',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_6 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_6 as string,
//     region: process.env.AWS_REGION_6 as string,
//     endpoint: process.env.AWS_ENDPOINT_6 as string,
//     availableCapacity: 15,
//     private: true,
//     provider: 'synology'
//   },
//   'videos 4': {
//     name: 'kch',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_7 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_7 as string,
//     region: process.env.AWS_REGION_7 as string,
//     endpoint: process.env.AWS_ENDPOINT_7 as string,
//     availableCapacity: 15,
//     private: true,
//     provider: 'synology'
//   },
//   'videos 5': {
//     name: 'tbox',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_8 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_8 as string,
//     region: process.env.AWS_REGION_8 as string,
//     endpoint: process.env.AWS_ENDPOINT_8 as string,
//     availableCapacity: 15,
//     private: true,
//     provider: 'synology'
//   },
//   'videos 6': {
//     name: 'tbox2',
//     accessKey: process.env.AWS_ACCESS_KEY_ID_9 as string,
//     secretKey: process.env.AWS_SECRET_ACCESS_KEY_9 as string,
//     region: process.env.AWS_REGION_9 as string,
//     endpoint: process.env.AWS_ENDPOINT_9 as string,
//     availableCapacity: 15,
//     private: true,
//     provider: 'synology'
//   },
// }



export async function replaceS3WithCDN(bucket: string, s3Url: string){
  const buckets = await getallBuckets();
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

    const objectPath = url.pathname.replace(`/${bucketConfig.name}`, "");

    const finalUrl = `${bucketConfig.cdnUrl}${objectPath}${url.search}`
    return finalUrl;
  } catch (error) {
    console.error(`Invalid S3 URL: ${s3Url}`, error);
    return s3Url;
  }
}

export async function getBucketConfig(bucket: string) {
  const buckets = await getallBuckets();
  const bucketConfig = buckets[bucket];
  if (!bucketConfig) {
    throw new Error(`Bucket "${bucket}" not found.`);
  }

  return bucketConfig;
}

export async function getbucketId(bucket: string) {
  const buckets = await getallBuckets();
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

export async function getPublicBuckets(){
  const buckets = await getallBuckets();
  return Object.values(buckets).filter((bucket) => bucket.private === false);
};

export async function publicbucketOptions() {
  const buckets = await getallBuckets();
  return Object.entries(buckets)
    .filter(([_, bucket]) => bucket.private === false) // Filter only public buckets
    .map(([key]) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
    }))
}

export async function privatebucketOptions() {
  const buckets = await getallBuckets();
  return Object.entries(buckets)
    .filter(([_, bucket]) => bucket.private === true) // Filter only public buckets
    .map(([key]) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
    }));
}

export async function bucketOptions() {
  const buckets = await getallBuckets();
  return Object.entries(buckets)
    .map(([key]) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
    }));
}

export async function bucketNames() {
  const buckets = await getallBuckets();
  return (Object.entries(buckets).map(([key, config]) => ({
    value: config.name, // Use the actual database name
    label: key.charAt(0).toUpperCase() + key.slice(1)
  })))
}

export async function getRedisBucketArrayCookies() {
  // Determine whether we use a secure cookie prefix.
  const secureCookie: boolean = process.env.NODE_ENV === "production";
  const cookiePrefix = secureCookie ? '__Secure-' : '';

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  // Filter cookies to include only those that represent bucket entries.
  const bucketCookies = allCookies.filter(cookie =>
    cookie.name.startsWith(`${cookiePrefix}bucket_`)
  );
  let redisbucketArray;
  if (bucketCookies.length > 0) {
    redisbucketArray = bucketCookies.map(cookie => {
      const bucketId = cookie.name.replace(`${cookiePrefix}bucket_`, '');
      return {
        key: [bucketId],
        value: cookie.value,
      };
    });
  } else {
    redisbucketArray = await fetch(`https://kv.kapil.app/kv/list?prefix=buckets,drive.kapil.app`).then(res => res.json())
  }
  return redisbucketArray;
}
