import { getTBBucketUsage } from '@/lib/actions/terabox';
import { query } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Refresh Terabox bucket usage statistics
 */
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { bucketIds } = await req.json();

        if (!Array.isArray(bucketIds) || bucketIds.length === 0) {
            return NextResponse.json(
                { error: 'bucketIds array is required' },
                { status: 400 },
            );
        }

        // Verify buckets exist
        const { rows: bucketsToRefresh } = await query(
            'SELECT id FROM tb_buckets WHERE id = ANY($1::int[])',
            [bucketIds],
        );

        if (bucketsToRefresh.length === 0) {
            return NextResponse.json(
                { error: 'No matching Terabox buckets found.' },
                { status: 404 },
            );
        }

        const bucketIdsToProcess = bucketsToRefresh.map((b: any) => b.id);

        // Get usage stats from backend API (currently placeholder)
        const usageStats = await Promise.all(
            bucketIdsToProcess.map((id: number) => getTBBucketUsage(id))
        );

        // Update database with fresh statistics
        const updatePromises = usageStats
            .filter(stat => stat.status === 'Success')
            .map(stat => {
                return query(
                    `UPDATE tb_buckets 
           SET space_used_bytes = $1, 
               space_available_gb = $2, 
               updated_at = NOW() 
           WHERE id = $3`,
                    [
                        stat.spaceUsedBytes ? Number(stat.spaceUsedBytes) : 0,
                        stat.spaceAvailableGB ? Number(stat.spaceAvailableGB) : 0,
                        stat.bucket
                    ],
                );
            });

        await Promise.all(updatePromises);

        return NextResponse.json({
            success: true,
            refreshed: updatePromises.length,
            message:
                updatePromises.length > 0
                    ? `Successfully refreshed ${updatePromises.length} bucket(s)`
                    : 'Backend API not yet implemented - no updates performed',
        });
    } catch (error: any) {
        console.error('Error refreshing Terabox bucket usage:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
