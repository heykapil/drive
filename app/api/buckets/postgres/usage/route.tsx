import { query } from '@/service/postgres';
import { getS3StorageUsage } from '@/service/s3-tebi';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { bucketIds } = await req.json();

    let bucketsToRefresh: { id: number }[];

    if (bucketIds && bucketIds.length > 0) {
      // If specific IDs are provided, fetch only those buckets
      const { rows } = await query(
        'SELECT id FROM s3_buckets WHERE id = ANY($1::int[])',
        [bucketIds],
      );
      bucketsToRefresh = rows;
    } else {
      // If no IDs are provided, fetch all buckets to refresh everything
      const { rows } = await query('SELECT id FROM s3_buckets');
      bucketsToRefresh = rows;
    }

    if (bucketsToRefresh.length === 0) {
      return NextResponse.json({
        message: 'No matching buckets found to refresh.',
      });
    }

    const bucketIdsToProcess = bucketsToRefresh.map(b => b.id);

    // Call your existing async function to get the latest usage stats
    const usageStats = await getS3StorageUsage(bucketIdsToProcess);

    // Prepare and execute database updates
    const updatePromises = usageStats
      // THIS IS THE FIX: Filter the array to only include success objects.
      .filter(stat => stat.status === 'Success')
      .map(stat => {
        return query(
          'UPDATE s3_buckets SET storage_used_bytes = $1, updated_at = NOW() WHERE id = $2',
          [stat.storageUsedBytes, stat.bucket],
        );
      });

    await Promise.all(updatePromises);

    return NextResponse.json({
      message: `Successfully refreshed storage usage for ${updatePromises.length} buckets.`,
      refreshed_buckets: updatePromises.length,
    });
  } catch (error) {
    console.error('Error refreshing S3 storage usage:', error);
    return NextResponse.json(
      { error: 'Internal server error while refreshing usage.' },
      { status: 500 },
    );
  }
}
