import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
   const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const expiresIn = Math.max(60, parseInt(searchParams.get("expiresIn") || "300", 10)); // Min 1 min, Default 5 mins
    const bucket = searchParams.get("bucket") || "";

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    if(!bucket){
      return NextResponse.json({success: false, error: 'Bucket name not provided'})
    }
    const bucketConfig = buckets[bucket]

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const { rows } = await query("SELECT key FROM files WHERE id = $1 AND bucket = $2", [fileId, bucketConfig.name]);
    if (!rows.length) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const client = await s3WithConfig(bucketConfig)
    const command = new GetObjectCommand({ Bucket: bucketConfig.name, Key: rows[0].key });
    const url = await getSignedUrl(client, command, { expiresIn: expiresIn });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
