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
