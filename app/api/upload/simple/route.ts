import { getBucketConfig, refreshBucketUsage } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const { searchParams } = new URL(req.url);
    const bucketIdParam = searchParams.get('bucket');
    let bucketId: number | undefined;
    let bucketType: 'S3' | 'TB' = 'S3'; // Default to S3

    if (bucketIdParam) {
      if (bucketIdParam.startsWith('s3_')) {
        bucketId = parseInt(bucketIdParam.replace('s3_', ''), 10);
        bucketType = 'S3';
      } else if (bucketIdParam.startsWith('tb_')) {
        bucketId = parseInt(bucketIdParam.replace('tb_', ''), 10);
        bucketType = 'TB';
      } else {
        bucketId = parseInt(bucketIdParam, 10);
        bucketType = 'S3';
      }
    }

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Bucket ID provided',
      });
    }

    if (bucketType === 'TB') {
      return NextResponse.json({
        success: false,
        error: 'Direct Terabox uploads via this endpoint are not yet supported. Please use the unified upload manager.',
      }, { status: 400 });
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

    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${file.name}`;
    const client = await s3WithConfig(bucketConfig);
    await client
      .send(
        new PutObjectCommand({
          Bucket: bucketConfig.name,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        }),
      )
      .then(
        async () =>
          await query(
            'INSERT INTO files (filename, key, size, type, bucket, bucket_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              file.name,
              key,
              file.size,
              file.type,
              bucketConfig.name,
              bucketConfig.id,
            ],
          ),
      )
      .finally(async () => await refreshBucketUsage([bucketConfig.id]));
    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
