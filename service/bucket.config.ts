export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint: string
  id: number
  totalCapacityGB?: number
  storageUsedBytes?: number
  private?: boolean
  cdnUrl?: string
  provider?: string
}


const configCache = new Map<string, BucketConfig[]>();

export async function getBucketConfig(bucketIds: number | number[]): Promise<BucketConfig[]> {
  const ids = Array.isArray(bucketIds) ? bucketIds.sort() : [bucketIds];
  const cacheKey = ids.join(',');

  if (configCache.has(cacheKey)) {
    console.log(`[getBucketConfig] Returning config from cache for key: ${cacheKey}`);
    return configCache.get(cacheKey)!;
  }

  // Construct the full URL WITHOUT query parameters
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${appUrl}/api/buckets/postgres/config?bucketIds=${cacheKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getBucketConfig] Fetch failed with status: ${response.status}`);
      console.error(`[getBucketConfig] Raw error response from API: ${errorText}`);
      throw new Error(`Failed to fetch bucket config. API returned status ${response.status}`);
    }

    const data: BucketConfig[] = await response.json();
    console.log(`[getBucketConfig] Successfully fetched config for buckets: ${cacheKey}`);

    configCache.set(cacheKey, data);
    return data;

  } catch (error) {
    console.error('[getBucketConfig] An unexpected error occurred during fetch:', error);
    return [];
  }
}


export async function encryptBucketConfig(bucketId: number){
  const response = await fetch(process.env.NEXT_PUBLIC_APP_URL+'/api/buckets/postgres/encrypt', {
    method: 'POST',
    body: JSON.stringify({ bucketId })
  })
  const { token } = await response.json()
  return token;
}
