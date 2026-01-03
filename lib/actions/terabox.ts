'use server'

import { getTBBucketConfig } from '@/service/tb-bucket.config'
import { getQuota, downloadFile, streamVideo, deleteFiles } from '@/lib/terabox-client'

/**
 * Get Terabox bucket usage statistics from backend API
 */
export async function getTBBucketUsage(bucketId: number): Promise<{
    bucket: number
    status: string
    spaceUsedBytes?: bigint
    spaceAvailableGB?: number
    spaceTotalBytes?: bigint
    message?: string
}> {
    try {
        const response = await getQuota({ bucket_id: bucketId })
        console.log(response)
        if (!response.success && response.errno !== 0) {
            return {
                bucket: bucketId,
                status: 'Error',
                message: response.error
            }
        }

        const quotaData = response.data;

        return {
            bucket: bucketId,
            status: 'Success',
            spaceUsedBytes: quotaData?.used,
            spaceAvailableGB: quotaData?.available,
            spaceTotalBytes: quotaData?.total,
        }
    } catch (error: any) {
        console.error('Error getting Terabox bucket usage:', error)
        return {
            bucket: bucketId,
            status: 'Error',
            message: error.message
        }
    }
}

/**
 * Get file download link from Terabox
 */
export async function getTBFileDownloadLink(tb_bucket_id: number, share_id: string): Promise<string | null> {
    const configs = await getTBBucketConfig(tb_bucket_id)

    if (configs.length === 0) {
        console.error('Terabox bucket not found:', tb_bucket_id)
        return null
    }

    try {
        const response = await downloadFile({
            bucket_id: tb_bucket_id,
            share_id: share_id
        })

        if ((!response.success && response.errno !== 0) || !response.data?.list?.[0]?.dlink) {
            console.error('Failed to get download link:', response.error)
            return null
        }
        return response.data.list[0].dlink;
        // return `https://api.kapil.app/terabox/proxy?bucket_id=${tb_bucket_id}&url=${encodeURIComponent(response.data.list[0].dlink)}`
    } catch (error) {
        console.error('Error fetching download link:', error)
        return null
    }
}

/**
 * Get file preview/streaming link from Terabox
 */
export async function getStreamLink(bucketId: number, fileKey: string,): Promise<string | null> {
    const configs = await getTBBucketConfig(bucketId)

    if (configs.length === 0) {
        console.error('Terabox bucket not found:', bucketId)
        return null
    }

    try {
        const response = await streamVideo('POST',
            JSON.stringify({
                path: fileKey,
                bucket_id: bucketId
            })
        )

        if (!response.ok) {
            console.error('Stream request failed:', response.statusText)
            return null
        }

        const m3u8Content = await response.text()
        return m3u8Content
    } catch (error) {
        console.error('Error getting stream link:', error)
        return null
    }
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
