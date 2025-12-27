'use server'
import { BucketConfig, getBucketConfig } from './bucket.config'
import { TBBucketConfig, getTBBucketConfig } from './tb-bucket.config'

/**
 * Discriminated union type for unified bucket configuration
 */
export type UnifiedBucketConfig =
    | { bucketType: 'S3'; config: BucketConfig }
    | { bucketType: 'TB'; config: TBBucketConfig }

/**
 * Bucket type enum for clarity
 */
export type BucketType = 'S3' | 'TB'

/**
 * Get unified bucket configuration for either S3 or Terabox bucket
 * @param bucketId - The bucket ID to fetch
 * @param bucketType - The type of bucket ('S3' or 'TB')
 * @returns Unified bucket configuration with type discriminator
 */
export async function getUnifiedBucketConfig(
    bucketId: number,
    bucketType: BucketType
): Promise<UnifiedBucketConfig | null> {
    try {
        if (bucketType === 'S3') {
            const configs = await getBucketConfig(bucketId)
            if (configs.length === 0) return null
            return { bucketType: 'S3', config: configs[0] }
        } else {
            const configs = await getTBBucketConfig(bucketId)
            if (configs.length === 0) return null
            return { bucketType: 'TB', config: configs[0] }
        }
    } catch (error) {
        console.error('Error fetching unified bucket config:', error)
        return null
    }
}

/**
 * Get multiple unified bucket configurations
 * @param buckets - Array of {id, type} objects
 */
export async function getUnifiedBucketConfigs(
    buckets: Array<{ id: number; type: BucketType }>
): Promise<UnifiedBucketConfig[]> {
    const results = await Promise.all(
        buckets.map(({ id, type }) => getUnifiedBucketConfig(id, type))
    )
    return results.filter((config): config is UnifiedBucketConfig => config !== null)
}

/**
 * Type guard to check if bucket is S3
 */
export function isS3Bucket(bucket: UnifiedBucketConfig): bucket is { bucketType: 'S3'; config: BucketConfig } {
    return bucket.bucketType === 'S3'
}

/**
 * Type guard to check if bucket is Terabox
 */
export function isTBBucket(bucket: UnifiedBucketConfig): bucket is { bucketType: 'TB'; config: TBBucketConfig } {
    return bucket.bucketType === 'TB'
}

/**
 * Detect bucket type from database row
 * Checks which bucket_id column is populated
 */
export function detectBucketType(row: { bucket_id?: number | null; tb_bucket_id?: number | null }): BucketType | null {
    if (row.bucket_id != null) return 'S3'
    if (row.tb_bucket_id != null) return 'TB'
    return null
}

/**
 * Get bucket ID and type from a database row
 */
export function extractBucketInfo(row: { bucket_id?: number | null; tb_bucket_id?: number | null }): { id: number; type: BucketType } | null {
    const type = detectBucketType(row)
    if (!type) return null

    const id = type === 'S3' ? row.bucket_id! : row.tb_bucket_id!
    return { id, type }
}

/**
 * Get bucket name from unified config
 */
export function getBucketName(bucket: UnifiedBucketConfig): string {
    return bucket.config.name
}

/**
 * Get bucket ID from unified config
 */
export function getBucketId(bucket: UnifiedBucketConfig): number {
    return bucket.config.id
}
