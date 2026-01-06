'use server'

import { getTBBucketConfig } from '@/service/tb-bucket.config'
import { getQuota, deleteFiles } from '@/lib/terabox-client'
import { getTBBucketUsage as getTBBucketUsageData, getTBFileDownloadLink as getTBFileDownloadLinkData } from '@/lib/data/terabox'

/**
 * Get Terabox bucket usage statistics from backend API
 */
export async function getTBBucketUsage(bucketId: number) {
    return getTBBucketUsageData(bucketId)
}

/**
 * Get file download link from Terabox
 */
export async function getTBFileDownloadLink(tb_bucket_id: number, share_id: string) {
    return getTBFileDownloadLinkData(tb_bucket_id, share_id)
}

/**
 * Test Terabox bucket connection
 */
export async function testTBConnection(bucketIds: number | number[]): Promise<{
    bucket: number
    name: string
    status: 'Success' | 'Error'
    message: string
}[]> {
    const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds]
    const configs = await getTBBucketConfig(ids)

    // Map existing configs by ID for easy lookup
    const configMap = new Map(configs.map(c => [c.id, c]))

    const results = await Promise.all(ids.map(async (id) => {
        const config = configMap.get(id)
        if (!config) {
            return {
                bucket: id,
                name: 'N/A',
                status: 'Error' as const,
                message: 'Bucket configuration not found'
            }
        }

        try {
            const response = await getQuota({ bucket_id: id })
            if (response.success || response.errno === 0) {
                return {
                    bucket: id,
                    name: config.name,
                    status: 'Success' as const,
                    message: 'Connection successful'
                }
            } else {
                return {
                    bucket: id,
                    name: config.name,
                    status: 'Error' as const,
                    message: response.error || 'Connection failed'
                }
            }
        } catch (error: any) {
            return {
                bucket: id,
                name: config.name,
                status: 'Error' as const,
                message: error.message
            }
        }
    }))

    return results
}

/**
 * Delete files from Terabox bucket
 */
export async function deleteTBFiles(bucketId: number, fileKeys: string[]): Promise<{ success: boolean; deleted: string[]; failed: string[] }> {
    try {
        const response = await deleteFiles({
            bucket_id: bucketId,
            paths: fileKeys
        })

        if (!response.success && response.errno !== 0) {
            throw new Error(response.error || 'Failed to delete files')
        }

        return {
            success: true,
            deleted: response.data?.info?.map((i: any) => i.path) || [],
            failed: response.data?.failed || []
        }
    } catch (error: any) {
        console.error('Error deleting Terabox files:', error)
        throw error
    }
}
