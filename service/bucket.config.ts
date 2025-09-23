'use server'
import { decryptSecret } from "@/lib/helpers/jose"
import { encryptTokenV4 } from "@/lib/helpers/paseto-ts"
import { cache } from "react"
import { query } from "./postgres"

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
 * Fetches a SINGLE bucket configuration from the database.
 * This function is the one we will wrap with `cache`.
 * It's intentionally not exported, as it's an internal implementation detail.
 */
const getSingleBucketConfigFromDb = async (bucketId: number): Promise<BucketConfig | null> => {
  const { rows } = await query("SELECT * FROM s3_buckets WHERE id = $1 LIMIT 1", [bucketId]);

  if (rows.length === 0) {
    return null;
  }

  const bucket = rows[0];
  // Simple mapping logic (ensure this matches your schema)
  return {
    id: bucket.id,
    name: bucket.name,
    accessKey: bucket.access_key_encrypted,
    secretKey: bucket.secret_key_encrypted,
    region: bucket.region,
    endpoint: bucket.endpoint,
    totalCapacityGB: bucket.total_capacity_gb,
    storageUsedBytes: bucket.storage_used_bytes,
    private: bucket.is_private,
    provider: bucket.provider,
  };
};

// 2. Create the cached version of the function
// Any calls to this function with the same `bucketId` within the same server request
// will be de-duplicated.
const getCachedBucketConfig = cache(getSingleBucketConfigFromDb);

/**
 * This is the primary function you will call from your server code.
 * It intelligently fetches multiple bucket configurations using the cached function.
 */
export async function getBucketConfig(bucketIds: number | number[]): Promise<BucketConfig[]> {
  try {
    const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds];
    const uniqueIds = [...new Set(ids)]; // Ensure we don't process duplicate IDs

    if (uniqueIds.length === 0) {
      return [];
    }

    // 3. Use Promise.all to fetch all configs in parallel.
    // React's `cache` will ensure that if getCachedBucketConfig(1) is called multiple
    // times across these promises, the database is only hit once for ID 1.
    const configPromises = uniqueIds.map(id => getCachedBucketConfig(id));

    const results = await Promise.all(configPromises);

    // Filter out any null results for IDs that were not found
    return results.filter((config: any): config is BucketConfig => config !== null)
  } catch(error){
    console.error(error)
    return []
  }
}


export async function encryptBucketConfig(bucketId: number){
  try {
    const config = await getBucketConfig(bucketId)
    const payload = {
      name: config[0].name,
      accessKey: await decryptSecret(config[0].accessKey),
      secretKey: await decryptSecret(config[0].secretKey),
      region: config[0].region,
      endpoint: config[0].endpoint,
      // availableCapacity: config[0]?.storageUsedBytes || 20,
      // private: config[0]?.private || true,
      // cdnUrl: config[0]?.cdnUrl || '',
      // provider: config[0]?.provider || 'synology'
    }
    const token = await encryptTokenV4(payload) as string;
    return token;
  } catch(error: any){
    console.error(error)
    throw new Error(error)
  }
}
