
import { getTBBucketConfig } from '@/service/tb-bucket.config'
import { getQuota, downloadFile, streamVideo } from '@/lib/terabox-client'
import { unstable_cache } from 'next/cache';

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
    } catch (error) {
        console.error('Error fetching download link:', error)
        return null
    }
}

export const STREAM_TYPES = {
    M3U8_AUTO_1080: 'M3U8_AUTO_1080',
    M3U8_AUTO_720: 'M3U8_AUTO_720',
    M3U8_AUTO_480: 'M3U8_AUTO_480',
    M3U8_AUTO_360: 'M3U8_AUTO_360',
    M3U8_FLV_264_480: 'M3U8_FLV_264_480',
    M3U8_AUTO_240: 'M3U8_AUTO_240',
} as const;

/**
 * Get file preview/streaming link from Terabox
 */
export async function getStreamLink(
    bucketId: number,
    fileKey: string,
    type: keyof typeof STREAM_TYPES = 'M3U8_AUTO_1080' // Default to highest quality
): Promise<string | null> {
    const configs = await getTBBucketConfig(bucketId)

    if (configs.length === 0) {
        console.error('Terabox bucket not found:', bucketId)
        return null
    }

    try {
        const response = await streamVideo('POST',
            JSON.stringify({
                path: fileKey,
                bucket_id: bucketId,
                type: type // Pass the requested type
            })
        )

        if (!response.ok) {
            // console.error(`Stream request failed for ${type}:`, response.statusText)
            return null
        }

        const m3u8Content = await response.text()
        return m3u8Content
    } catch (error) {
        console.error(`Error getting stream link for ${type}:`, error)
        return null
    }
}

/**
 * Robustly get stream link with quality fallback and caching
 */
export const getStreamLinkCached = unstable_cache(
    async (bucketId: number, fileKey: string) => {
        const qualityChain: (keyof typeof STREAM_TYPES)[] = [
            'M3U8_AUTO_1080',
            'M3U8_AUTO_720',
            'M3U8_AUTO_480',
            'M3U8_AUTO_360',
            'M3U8_AUTO_240'
        ];

        for (const quality of qualityChain) {
            // console.log(`Attempting to fetch stream with quality: ${quality}`);

            // Simple retry logic for transient network issues
            for (let i = 0; i < 2; i++) {
                const link = await getStreamLink(bucketId, fileKey, quality);
                if (link && link.includes('#EXTM3U')) {
                    // console.log(`Successfully found stream with quality: ${quality}`);
                    return link;
                }
                // Wait slightly before retry
                if (i === 0) await new Promise(r => setTimeout(r, 500));
            }
        }

        return null;
    },
    ['terabox-stream-link'],
    {
        revalidate: 600, // Cache for 10 minutes
        tags: ['terabox-stream'] // Allow manual revalidation if needed
    }
);
