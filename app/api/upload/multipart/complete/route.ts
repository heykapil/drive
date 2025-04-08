import {  getallBuckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
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

    const { uploadId, key, parts, filename, size, type } = await req.json();
    const contentType = type ? type : "application/octet-stream";
    if (!uploadId || !key || !parts || !filename || !size) {
      return NextResponse.json({ success: false, error: "Missing required fields"}, { status: 400 });
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketConfig.name,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    const client = await s3WithConfig(bucketConfig);
    await client.send(command).then( async () =>
    await query("INSERT INTO files (filename, key, size, type, bucket) VALUES ($1, $2, $3, $4, $5)", [
      filename, key, size, contentType, bucketConfig.name
    ]));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
