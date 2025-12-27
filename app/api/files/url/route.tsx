import { getStreamLink } from '@/lib/actions/terabox';
import { getBucketConfig } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi'; // Assuming this is the correct path
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');
    const expiresIn = Math.max(
      60,
      parseInt(searchParams.get('expiresIn') || '600', 10),
    );

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 },
      );
    }

    const { rows } = await query(
      'SELECT key, share_id, bucket_id, tb_bucket_id FROM files WHERE id = $1',
      [fileId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { key, share_id, bucket_id, tb_bucket_id } = rows[0];
    if (tb_bucket_id) {
      // Import dynamically to avoid circular deps if any, or just consistent with previous
      const { getTBFileDownloadLink } = await import('@/lib/actions/terabox');
      const downloadUrl = await getTBFileDownloadLink(tb_bucket_id, share_id || key); // Fallback to key if share_id empty? unlikely if logic correct
      return NextResponse.json({ url: downloadUrl });
    }

    // Handle S3 Files
    const bucketConfigArray = await getBucketConfig(bucket_id);

    if (!bucketConfigArray || bucketConfigArray.length === 0) {
      return NextResponse.json(
        { error: `Configuration for bucket ${bucket_id} not found` },
        { status: 500 },
      );
    }
    const bucketConfig = bucketConfigArray[0];

    const client = await s3WithConfig(bucketConfig);

    const command = new GetObjectCommand({
      Bucket: bucketConfig.name,
      Key: key,
    });
    const url = await getSignedUrl(client, command, { expiresIn: expiresIn });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error Details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
