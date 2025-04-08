import { getallBuckets } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { AbortMultipartUploadCommand, ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    if (!bucket) {
      return NextResponse.json({ success: false, error: "Bucket name not provided" });
    }

    const buckets = await getallBuckets()
    const bucketConfig = buckets[bucket];
    if (!bucketConfig?.name) {
      return NextResponse.json({ success: false, error: "Wrong bucket id provided" });
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
    if (!bucket || !uploadId || !key) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const buckets = await getallBuckets();
    const bucketConfig = buckets[bucket];
    if (!bucketConfig?.name) {
      return NextResponse.json({ success: false, error: "Wrong bucket id provided" });
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
