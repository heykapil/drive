'use server'
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

/**
 * In-memory cache that stores a promise for an *individual* BucketConfig.
 * The key is the bucket ID (number).
 */
const bucketConfigCache = new Map<number, Promise<BucketConfig>>();

export async function getBucketConfig(bucketIds: number | number[]): Promise<BucketConfig[]> {
  const uniqueIds = [...new Set(Array.isArray(bucketIds) ? bucketIds : [bucketIds])];

  const promises: Promise<BucketConfig>[] = [];
  const idsToFetch: number[] = [];

  // 2. Partition IDs: Separate the ones we have cached from the ones we need to fetch.
  for (const id of uniqueIds) {
    if (bucketConfigCache.has(id)) {
      // console.log(`✅ Cache HIT for bucket ID: ${id}`);
      promises.push(bucketConfigCache.get(id)!);
    } else {
      // console.log(`❌ Cache MISS for bucket ID: ${id}`);
      idsToFetch.push(id);
    }
  }

  // 3. If there are any missing IDs, fetch them all in a single API call.
  if (idsToFetch.length > 0) {
    // console.log(`📡 Fetching new bucket IDs from API: ${idsToFetch.join(', ')}`);

    const fetchPromise = fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/postgres/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketIds: idsToFetch })
    }).then(async (response) => {
      if (!response.ok) {
        // On error, remove the promises we were trying to add, allowing for retries.
        idsToFetch.forEach(id => bucketConfigCache.delete(id));
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bucket config with status: ${response.status}`);
      }
      return response.json() as Promise<BucketConfig[]>;
    });

    // 4. VERY IMPORTANT: Create individual promises for each ID from the batch request
    // and add them to the cache. This populates the cache for future single-ID calls.
    for (const id of idsToFetch) {
      const individualConfigPromise = fetchPromise.then((configs) => {
        const config = configs.find(c => c.id === id); // Assuming your config object has an 'id' property
        if (!config) {
          throw new Error(`Config for bucket ID ${id} was not returned from the API.`);
        }
        return config;
      });

      bucketConfigCache.set(id, individualConfigPromise);
      promises.push(individualConfigPromise);
    }
  }
  return Promise.all(promises);
}


export async function encryptBucketConfig(bucketId: number){
  const response = await fetch(process.env.NEXT_PUBLIC_APP_URL+'/api/buckets/postgres/encrypt', {
    method: 'POST',
    body: JSON.stringify({ bucketId })
  })
  const { token } = await response.json()
  return token;
}
