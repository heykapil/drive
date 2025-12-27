'use server'

import { getTBBucketConfig } from '@/service/tb-bucket.config'
import { client } from '@/lib/terabox-client'

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
        const response = await client.terabox.teraboxQuota({ bucket_id: bucketId })

        if (!response.success) {
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
        const response = await client.terabox.teraboxDownload({
            bucket_id: tb_bucket_id,
            share_id: share_id
        })

        if (!response.success || !response.data?.list?.[0]?.dlink) {
            console.error('Failed to get download link:', response.error)
            return null
        }

        return `https://api.kapil.app/terabox/proxy?url=${encodeURIComponent(response.data.list[0].dlink)}`
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
        // Note: teraboxStream returns a Response object because it's a streaming endpoint in the client definition
        // We need to call the API endpoint that returns the M3U8 content or stream URL
        // However, the generated client definition for teraboxStream takes (method, body, options) -> Response
        // This is generic. Let's look at how we can use it or if we should use a different approach.
        // Actually, for stream we might want the m3u8 TEXT content, not the stream bytes itself if it's HLS.
        // The previous implementation fetched text.

        // Let's use the client to fetch the m3u8 content
        const response = await client.terabox.teraboxStream('POST',
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
            const response = await client.terabox.teraboxQuota({ bucket_id: id })
            if (response.success) {
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
export async function deleteTBFiles(bucketId: number, fileKeys: string[], shareIds?: string[]): Promise<{ success: boolean; deleted: string[]; failed: string[] }> {
    try {
        const response = await client.terabox.teraboxDelete({
            bucket_id: bucketId,
            paths: fileKeys
        })

        if (!response.success) {
            throw new Error(response.error || 'Failed to delete files')
        }

        return {
            success: true,
            deleted: response.data?.deleted || [],
            failed: response.data?.failed || []
        }
    } catch (error: any) {
        console.error('Error deleting Terabox files:', error)
        throw error
    }
}
