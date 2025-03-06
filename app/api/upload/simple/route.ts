import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    if(!bucket){
      return NextResponse.json({success: false, error: 'Bucket name not provided'})
    }

    const bucketConfig = buckets[bucket]

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${file.name}`;
    const client = await s3WithConfig(bucketConfig);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketConfig.name,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    ).then(async () => await query(
      "INSERT INTO files (filename, key, size, type, bucket) VALUES ($1, $2, $3, $4, $5)",
      [file.name, key, file.size, file.type, bucketConfig.name]
    ));
    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
