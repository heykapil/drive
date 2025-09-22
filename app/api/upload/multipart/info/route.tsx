import { getBucketConfig } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { AbortMultipartUploadCommand, ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucketIdParam = searchParams.get("bucket");

    const bucketId = bucketIdParam ? parseInt(bucketIdParam, 10) : NaN;

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
        return NextResponse.json({
          success: false,
          error: "Bucket ID must be a positive integer",
        });
      }

    const bucketConfigArray = await getBucketConfig(bucketId)

    if(bucketConfigArray.length===0){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const bucketConfig = bucketConfigArray[0];

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
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

    const bucketId = bucket ? parseInt(bucket, 10) : NaN;

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
        return NextResponse.json({
          success: false,
          error: "Bucket ID must be a positive integer",
        });
      }

    const bucketConfigArray = await getBucketConfig(bucketId)

    if(bucketConfigArray.length===0){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const bucketConfig = bucketConfigArray[0];

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
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
