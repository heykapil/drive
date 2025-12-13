import { getBucketConfig, refreshBucketUsage } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucketIdParam = searchParams.get('bucket');

    const bucketId = bucketIdParam ? parseInt(bucketIdParam, 10) : NaN;

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Bucket ID must be a positive integer',
      });
    }

    const bucketConfigArray = await getBucketConfig(bucketId);

    if (bucketConfigArray.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Wrong bucket id provided',
      });
    }

    const bucketConfig = bucketConfigArray[0];

    if (!bucketConfig.name) {
      return NextResponse.json({
        success: false,
        error: 'Wrong bucket id provided',
      });
    }

    const { uploadId, key, parts, filename, size, type } = await req.json();
    const contentType = type ? type : 'application/octet-stream';
    if (!uploadId || !key || !parts || !filename || !size) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketConfig.name,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    const client = await s3WithConfig(bucketConfig);
    await client
      .send(command)
      .then(
        async () =>
          await query(
            'INSERT INTO files (filename, key, size, type, bucket, bucket_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              filename,
              key,
              size,
              contentType,
              bucketConfig.name,
              bucketConfig.id,
            ],
          ),
      )
      .then(async () => await refreshBucketUsage([bucketConfig.id]));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
