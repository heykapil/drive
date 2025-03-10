import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { PutObjectAclCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    if (!bucket) {
      return NextResponse.json({ success: false, error: "Bucket name not provided" });
    }

    const bucketConfig = buckets[bucket];

    if (!bucketConfig.name) {
      return NextResponse.json({ success: false, error: "Wrong bucket id provided" });
    }

    const body = await req.json();

    if (!Array.isArray(body.fileIds) || body.fileIds.length === 0 || typeof body.isPublic !== "boolean") {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const fileIds: string[] = body.fileIds;
    const isPublic: boolean = body.isPublic;

    // Batch query to get all file keys in one go
    type FileRecord = { id: string; key: string };
    const { rows }: { rows: FileRecord[] } = await query(
      `SELECT id, key FROM files WHERE id = ANY($1::int[]) AND bucket = $2`,
      [fileIds.map(Number), bucketConfig.name] // Convert string[] to number[]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No matching files found" }, { status: 404 });
    }

    const client = await s3WithConfig(bucketConfig);

    // Limit S3 requests using Promise.allSettled()
    const s3Updates = rows.map(({ id, key }) =>
      client
        .send(
          new PutObjectAclCommand({
            Bucket: bucketConfig.name,
            Key: key,
            ACL: isPublic ? "public-read" : "private",
          })
        )
        .then(() => id) // Resolve with the file ID
        .catch(() => null) // Ignore failures
    );

    const results = await Promise.allSettled(s3Updates);

    // Extract only successful file IDs
    const updatedFileIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled" && result.value !== null)
      .map((result) => result.value);

    if (updatedFileIds.length > 0) {
      // Batch update SQL query for successful S3 updates
      await query(
        `UPDATE files SET is_public = $1 WHERE id = ANY($2::int[]) AND bucket = $3`,
        [isPublic, `{${updatedFileIds.map(Number)}}`, bucketConfig.name]
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedFileIds.length,
      failedCount: fileIds.length - updatedFileIds.length,
    });

  } catch (error) {
    console.error("Error updating file ACL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
