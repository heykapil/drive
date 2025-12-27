import { getBucketConfig } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { AbortMultipartUploadCommand, ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucketIdParam = searchParams.get("bucket");
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
        error: "Invalid Bucket ID provided",
      });
    }

    if (bucketType === 'TB') {
      return NextResponse.json({
        success: false,
        error: "Terabox multipart upload not yet supported",
      }, { status: 400 });
    }

    const bucketConfigArray = await getBucketConfig(bucketId)

    if (bucketConfigArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Wrong bucket id provided' })
    }

    const bucketConfig = bucketConfigArray[0];

    if (!bucketConfig.name) {
      return NextResponse.json({ success: false, error: 'Wrong bucket id provided' })
    }


    const client = await s3WithConfig(bucketConfig);
    const command = new ListMultipartUploadsCommand({
      Bucket: bucketConfig.name,
    });
    const result = await client.send(command);
    return NextResponse.json({ success: true, uploads: result.Uploads || [] });
  } catch (error) {
    console.error("Error listing multipart uploads:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}


export async function DELETE(req: NextRequest) {
  try {
    const { bucket, uploadId, key } = await req.json();
    if (!uploadId || !key) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    let bucketId: number | undefined;
    let bucketType: 'S3' | 'TB' = 'S3';
    const bucketParam = bucket ? bucket.toString() : undefined;

    if (bucketParam) {
      if (bucketParam.startsWith('s3_')) {
        bucketId = parseInt(bucketParam.replace('s3_', ''), 10);
        bucketType = 'S3';
      } else if (bucketParam.startsWith('tb_')) {
        bucketId = parseInt(bucketParam.replace('tb_', ''), 10);
        bucketType = 'TB';
      } else {
        bucketId = parseInt(bucketParam, 10);
        bucketType = 'S3';
      }
    }

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid Bucket ID provided",
      });
    }

    if (bucketType === 'TB') {
      return NextResponse.json({
        success: false,
        error: "Terabox multipart upload not yet supported",
      }, { status: 400 });
    }

    const bucketConfigArray = await getBucketConfig(bucketId)

    if (bucketConfigArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Wrong bucket id provided' })
    }

    const bucketConfig = bucketConfigArray[0];

    if (!bucketConfig.name) {
      return NextResponse.json({ success: false, error: 'Wrong bucket id provided' })
    }

    const client = await s3WithConfig(bucketConfig);
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketConfig.name,
      Key: key,
      UploadId: uploadId,
    });
    await client.send(command);

    return NextResponse.json({ success: true, message: "Upload aborted successfully" });
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
