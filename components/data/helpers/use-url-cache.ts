import { useRef } from "react";
import { toast } from "sonner";
import { getBucketInfo } from "@/hooks/use-bucket-store";

interface CacheItem {
    url: string;
    expiresAt: number;
}

const CACHE_DURATION_MS = 7000 * 1000; // 7000 seconds (slightly less than 7200 to be safe)

export function useFileUrlCache(selectedBucketId: string | number | null) {
    const urlCache = useRef<Map<string, CacheItem>>(new Map());

    const getDownloadUrl = async (id: string) => {
        const now = Date.now();
        const cached = urlCache.current.get(id);

        if (cached && now < cached.expiresAt) {
            return cached.url;
        }

        // If expired or not found, clear strictly if existing
        if (cached) {
            urlCache.current.delete(id);
        }

        try {
            const bucketParam = selectedBucketId ? `&bucket=${selectedBucketId}` : '';
            const res = await fetch(`/api/files/url?fileId=${id}&expiresIn=7200${bucketParam}`);
            const { url, error } = await res.json();

            if (error) {
                toast.error(error);
                return null;
            }

            urlCache.current.set(id, {
                url,
                expiresAt: now + CACHE_DURATION_MS
            });

            return url;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to get download URL');
            return null;
        }
    };

    const getPreviewUrl = async (file: any) => {
        const bucketIdToUse = file.bucket_id || selectedBucketId || (file.tb_bucket_id ? `tb_${file.tb_bucket_id}` : 0);
        const bucket = getBucketInfo(bucketIdToUse);
        if (bucket?.provider !== 'synology' && bucket?.bucketType !== 'TB') {
            return file.url;
        }

        if (bucket?.bucketType === 'TB') {
            return `/api/files/stream/${file.id}/index.m3u8`;
        }
        return await getDownloadUrl(file.id);
    };

    return { getDownloadUrl, getPreviewUrl };
}
