import { useRef } from "react";
import { toast } from "sonner";
import { getBucketInfo } from "@/hooks/use-bucket-store";

interface CacheItem {
    url: string;
    expiresAt: number;
}

const CACHE_DURATION_MS = 7000 * 1000; // 7000 seconds (slightly less than 7200 to be safe)

export function useFileUrlCache(selectedBucketId: number | null) {
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
            const res = await fetch(`/api/files/url?bucket=${selectedBucketId}&fileId=${id}&expiresIn=7200`);
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
        // If file is public, check if we can use the direct URL
        if (file.is_public) {
            const bucket = getBucketInfo(file.bucket_id || selectedBucketId || 0);
            // If it's not Synology (or assumed safe), use the direct URL. 
            if (bucket?.provider !== 'synology') {
                return file.url;
            }
        }
        // Fallback to generating a signed/download URL
        return await getDownloadUrl(file.id);
    };

    return { getDownloadUrl, getPreviewUrl };
}
