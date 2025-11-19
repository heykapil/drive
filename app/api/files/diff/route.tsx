import { BucketConfig, getBucketConfig } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const folderIdParam = searchParams.get('folderId');
        const bucketIdParam = searchParams.get('bucketId');

        if (!folderIdParam && !bucketIdParam) {
            return NextResponse.json({ error: 'Missing folderId or bucketId' }, { status: 400 });
        }

        let bucketIds: number[] = [];

        // 1. Determine Bucket IDs
        if (bucketIdParam) {
            bucketIds = [parseInt(bucketIdParam)];
        } else if (folderIdParam) {
            const folderId = parseInt(folderIdParam);
            // Get buckets associated with the folder
            const { rows } = await query(
                `SELECT bucket_id FROM folder_buckets WHERE folder_id = $1`,
                [folderId]
            );
            bucketIds = rows.map((r: any) => r.bucket_id);
        }

        if (bucketIds.length === 0) {
            return NextResponse.json({ files: [] });
        }

        // 2. Fetch Bucket Configs
        const bucketConfigs = await getBucketConfig(bucketIds);

        // 3. Fetch Files from Postgres (for these buckets)
        // We need to check files that belong to these buckets.
        // If folderId is provided, we might want to filter by folder?
        // The prompt says "based on this folderId or bucketId, it will check the postgres files table... and check whichever files are not in sync"
        // The `files` table has `bucket_id`. It doesn't seem to have `folder_id` directly,
        // but `folder_buckets` links folders and buckets.
        // However, `files` table structure: id, filename, key, size, type, bucket_id...
        // So we filter by bucket_id.

        const { rows: dbFiles } = await query(
            `SELECT "key", bucket_id FROM files WHERE bucket_id = ANY($1::int[])`,
            [bucketIds]
        );

        const dbFileKeys = new Set(dbFiles.map((f: any) => `${f.bucket_id}:${f.key}`));

        // 4. Fetch Files from S3 and Compare
        const missingFiles: any[] = [];

        await Promise.all(bucketConfigs.map(async (config) => {
            try {
                const s3 = await s3WithConfig(config);
                let continuationToken: string | undefined = undefined;

                do {
                    const command = new ListObjectsV2Command({
                        Bucket: config.name,
                        ContinuationToken: continuationToken,
                    });
                    const response = await s3.send(command) as any;

                    if (response.Contents) {
                        for (const obj of response.Contents) {
                            if (!obj.Key) continue;

                            // Check if this file exists in DB
                            // We use a composite key of bucketId:fileKey to be safe across buckets
                            const compositeKey = `${config.id}:${obj.Key}`;

                            if (!dbFileKeys.has(compositeKey)) {
                                missingFiles.push({
                                    key: obj.Key,
                                    size: obj.Size,
                                    lastModified: obj.LastModified,
                                    bucketId: config.id,
                                    bucketName: config.name,
                                    url: config.endpoint ? `${config.endpoint}/${config.name}/${obj.Key}` : null // Construct a rough URL if possible
                                });
                            }
                        }
                    }
                    continuationToken = response.NextContinuationToken;
                } while (continuationToken);

            } catch (err) {
                console.error(`Error listing objects for bucket ${config.name}:`, err);
                // We might want to return a partial error or just log it.
                // For now, we'll continue checking other buckets.
            }
        }));

        return NextResponse.json({ files: missingFiles });

    } catch (error: any) {
        console.error('Error in diff API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
