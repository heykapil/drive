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


 const configCache = new Map<string, any>();

 export async function getBucketConfig(bucketIds: number | number[]): Promise<BucketConfig[]> {
   const ids = Array.isArray(bucketIds) ? bucketIds.sort() : [bucketIds];
   const cacheKey = ids.join(',');

   if (configCache.has(cacheKey)) {
     console.log(`[getBucketConfig] Returning config from cache for key: ${cacheKey}`);
     return configCache.get(cacheKey);
   }

   // Construct the full URL, crucial for server-side fetching
   const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
   const url = `${appUrl}/api/buckets/postgres/config?bucketIds=${cacheKey}`;

   try {
     console.log(`[getBucketConfig] Fetching from URL: ${url}`);
     const response = await fetch(url, {
       method: 'POST',
       body: JSON.stringify({
         bucketIds: ids,
       }),
       headers: { 'Content-Type': 'application/json' },
       next: { revalidate: 60 } // Optional: revalidate cache every 60 seconds
     });

     if (!response.ok) {
       const errorText = await response.text(); // Get the raw response body
       console.error(`[getBucketConfig] Fetch failed with status: ${response.status}`);
       console.error(`[getBucketConfig] Raw error response from API: ${errorText}`);
       throw new Error(`Failed to fetch bucket config. API returned status ${response.status}`);
     }

     const data = await response.json();
     console.log(`[getBucketConfig] Successfully fetched config for buckets: ${cacheKey}`);

     configCache.set(cacheKey, data); // Store result in cache
     return data;

   } catch (error) {
     console.error('[getBucketConfig] An unexpected error occurred during fetch:', error);
     return []; // Return an empty array on failure
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
