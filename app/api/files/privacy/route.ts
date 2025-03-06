import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { PutObjectAclCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const bucket = searchParams.get("bucket") || "";

    if(!bucket){
      return NextResponse.json({success: false, error: 'Bucket name not provided'})
    }
    const bucketConfig = buckets[bucket]

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }
    const { fileId, isPublic } = await req.json();

    if (!fileId || typeof isPublic !== "boolean") {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const { rows } = await query("SELECT key FROM files WHERE id = $1 AND bucket =$2", [fileId, bucketConfig.name]);
    if (!rows.length) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const client = await s3WithConfig(bucketConfig);
    await client.send(
      new PutObjectAclCommand({
        Bucket: bucketConfig.name,
        Key: rows[0].key,
        ACL: isPublic ? "public-read" : "private",
      })
    ).then(async () => await query("UPDATE files SET is_public = $1 WHERE id = $2 AND bucket = $3", [isPublic, fileId, bucketConfig.name]));

    return NextResponse.json({ message: `File is now ${isPublic ? "public" : "private"}` });
  } catch (error) {
    console.error("Error updating file ACL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
