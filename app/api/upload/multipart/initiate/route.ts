import { getBucketConfig } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const bucketIdParam = searchParams.get('bucket');
    let bucketId: number | undefined;
    let bucketType: 'S3' | 'TB' = 'S3';

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
        error: 'Terabox multipart upload not yet supported',
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

    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { success: false, error: 'Missing filename or content type' },
        { status: 400 },
      );
    }

    const { rows } = await query('SELECT FROM files where filename = $1', [
      filename,
    ]);

    if (rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'File with this name already exists!' },
        { status: 409 },
      );
    }

    const key = `uploads/${filename}`;
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketConfig.name,
      Key: key,
      ContentType: contentType,
    });

    const client = await s3WithConfig(bucketConfig);
    const response = await client.send(command);
    if (!response.UploadId) {
      return NextResponse.json(
        { success: false, error: 'Failed to initiate upload' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      uploadId: response.UploadId,
      key,
    });
  } catch (error: unknown) {
    console.error('Error initiating multipart upload:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
