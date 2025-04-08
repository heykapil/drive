import { getallBuckets } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    if(!bucket){
      return NextResponse.json({success: false, error: 'Bucket name not provided'})
    }

    const buckets = await getallBuckets()
    const bucketConfig = buckets[bucket]

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const { uploadId, key, partNumber } = await req.json();
    if (!uploadId || !key || !partNumber) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const command = new UploadPartCommand({
      Bucket: bucketConfig.name,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const client = await s3WithConfig(bucketConfig);
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    return NextResponse.json({ success: true, url, partNumber });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
