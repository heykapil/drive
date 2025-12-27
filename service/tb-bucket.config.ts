'use server'
import { encryptTokenV4 } from "@/lib/helpers/paseto-ts"
import { cache } from "react"
import { query } from "./postgres"

export interface TBBucketConfig {
    id: number
    name: string
    emailEncrypted: string
    passwordEncrypted: string
    cookieEncrypted: string
    whost: string
    accountId: string
    accountName: string
    isVip: boolean
    vipType: number
    spaceTotalBytes: bigint
    spaceUsedBytes: bigint
    spaceAvailableGB: number
    cookieExpiresAt?: Date
    createdAt: Date
    updatedAt: Date
}

/**
 * Fetches a SINGLE Terabox bucket configuration from the database.
 * This function is the one we will wrap with `cache`.
 * It's intentionally not exported, as it's an internal implementation detail.
 */
const getSingleTBBucketConfigFromDb = async (bucketId: number): Promise<TBBucketConfig | null> => {
    const { rows } = await query("SELECT * FROM tb_buckets WHERE id = $1 LIMIT 1", [bucketId]);

    if (rows.length === 0) {
        return null;
    }

    const bucket = rows[0];
    return {
        id: bucket.id,
        name: bucket.name,
        emailEncrypted: bucket.email_encrypted,
        passwordEncrypted: bucket.password_encrypted,
        cookieEncrypted: bucket.cookie_encrypted,
        whost: bucket.whost,
        accountId: bucket.account_id,
        accountName: bucket.account_name,
        isVip: bucket.is_vip,
        vipType: bucket.vip_type,
        spaceTotalBytes: bucket.space_total_bytes,
        spaceUsedBytes: bucket.space_used_bytes,
        spaceAvailableGB: bucket.space_available_gb,
        cookieExpiresAt: bucket.cookie_expires_at,
        createdAt: bucket.created_at,
        updatedAt: bucket.updated_at,
    };
};

// Create the cached version of the function
const getCachedTBBucketConfig = cache(getSingleTBBucketConfigFromDb);

/**
 * This is the primary function you will call from your server code.
 * It intelligently fetches multiple Terabox bucket configurations using the cached function.
 */
export async function getTBBucketConfig(bucketIds: number | number[]): Promise<TBBucketConfig[]> {
    try {
        const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds];
        const uniqueIds = [...new Set(ids)]; // Ensure we don't process duplicate IDs

        if (uniqueIds.length === 0) {
            return [];
        }

        // Use Promise.all to fetch all configs in parallel.
        // React's `cache` will ensure that if getCachedTBBucketConfig(1) is called multiple
        // times across these promises, the database is only hit once for ID 1.
        const configPromises = uniqueIds.map(id => getCachedTBBucketConfig(id));

        const results = await Promise.all(configPromises);

        // Filter out any null results for IDs that were not found
        return results.filter((config: any): config is TBBucketConfig => config !== null)
    } catch (error) {
        console.error(error)
        return []
    }
}

/**
 * Encrypts a Terabox bucket configuration for secure transmission
 * No requirement in our 
 */
// export async function encryptTBBucketConfig(bucketId: number) {
//     try {
//         const config = await getTBBucketConfig(bucketId)
//         if (config.length === 0) {
//             throw new Error('Terabox bucket not found')
//         }

//         const payload = {
//             name: config[0].name,
//             email: config[0].emailEncrypted,
//             password: config[0].passwordEncrypted,
//             cookie: config[0].cookieEncrypted,
//             whost: config[0].whost,
//         }
//         const token = await encryptTokenV4(payload) as string;
//         return token;
//     } catch (error: any) {
//         console.error(error)
//         throw new Error(error)
//     }
// }

/**
 * Refreshes Terabox bucket usage statistics from the backend API
 * This will be implemented once you provide the actual backend API endpoints
 */
export async function refreshTBBucketUsage(bucketIds: number[]) {
    try {
        let bucketsToRefresh: { id: number }[];
        if (bucketIds && bucketIds.length > 0) {
            const { rows } = await query("SELECT id FROM tb_buckets WHERE id = ANY($1::int[])", [bucketIds]);
            bucketsToRefresh = rows;
        } else {
            bucketsToRefresh = [];
        }

        if (bucketsToRefresh.length === 0) {
            throw new Error("No matching Terabox buckets found to refresh.");
        }

        const bucketIdsToProcess = bucketsToRefresh.map(b => b.id);

        // TODO: Replace with actual backend API call
        // const usageStats = await getTBBucketUsageFromBackend(bucketIdsToProcess);

        // Placeholder: For now, return success without actual API call
        console.warn('refreshTBBucketUsage: Backend API not yet implemented. Using placeholder.');

        // When backend API is ready, uncomment and implement:
        /*
        const updatePromises = usageStats
          .filter(stat => stat.status === "Success")
          .map(stat => {
            return query(
              "UPDATE tb_buckets SET space_used_bytes = $1, space_available_gb = $2, updated_at = NOW() WHERE id = $3",
              [stat.spaceUsedBytes, stat.spaceAvailableGB, stat.bucket]
            );
          });
    
        await Promise.all(updatePromises);
        return { success: true, refreshed: updatePromises.length }
        */

        return { success: true, refreshed: 0, message: 'Backend API not yet implemented' }
    } catch (error: any) {
        throw new Error(error)
    }
}
