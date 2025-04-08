import {  getallBuckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
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

    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ success: false, error: "Missing filename or content type" }, { status: 400 });
    }

    const { rows } = await query('SELECT FROM files where filename = $1', [filename])

    if (rows.length > 0) {
      return NextResponse.json({ success: false, error: "File with this name already exists!" }, { status: 409 });
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
      return NextResponse.json({ success: false, error: "Failed to initiate upload" }, { status: 500 });
    }

    return NextResponse.json({ success: true, uploadId: response.UploadId, key });
  } catch (error: unknown) {
    console.error("Error initiating multipart upload:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
