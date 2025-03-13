import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "uploaded_at_desc";
    const selectedBucket = searchParams.get("bucket");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * limit;
    if(!selectedBucket){
      return NextResponse.json({error: 'No bucket selected'}, {status: 400})
    }
    const bucketConfig = buckets[selectedBucket]
    if(!bucketConfig.name){
      return NextResponse.json({error: 'Wrong bucket selected'}, {status: 400})
    }

    const sortOptions: Record<string, string> = {
      name_asc: "filename ASC",
      name_desc: "filename DESC",
      size_asc: "size ASC",
      size_desc: "size DESC",
      type_asc: "type ASC",
      type_desc: "type DESC",
      uploaded_at_asc: "uploaded_at ASC",
      uploaded_at_desc: "uploaded_at DESC",
    };
    const orderBy = sortOptions[sort] || "uploaded_at DESC";

    const { rows } = await query(
      `SELECT id, filename, key, size, type, uploaded_at, is_public, bucket
       FROM files
       WHERE bucket = $4 AND filename ILIKE $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset, bucketConfig.name]
    );

    const { rows: countRows } = await query(
      "SELECT COUNT(*)::int AS total FROM files WHERE bucket = $2 AND filename ILIKE $1",
      [`%${search}%`, bucketConfig.name]
    );

    const totalFiles = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalFiles / limit);

    return NextResponse.json({ files: rows, total: totalFiles, page, totalPages, limit });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { fileIds } = await req.json(); // ✅ Expecting multiple fileIds in an array

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "At least one file ID is required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const selectedBucket = searchParams.get("bucket");

    if (!selectedBucket) {
      return NextResponse.json({ error: "No bucket selected" }, { status: 400 });
    }

    const bucketConfig = buckets[selectedBucket];
    if (!bucketConfig?.name) {
      return NextResponse.json({ error: "Invalid bucket selection" }, { status: 400 });
    }

    // ✅ Fetch all file keys in a **single query**
    const { rows } = await query<{ key: string }>(
      "SELECT key FROM files WHERE id = ANY($1::int[]) AND bucket = $2",
      [fileIds, bucketConfig.name]
    );


    if (rows.length === 0) {
      return NextResponse.json({ error: "No matching files found" }, { status: 404 });
    }

    const client = await s3WithConfig(bucketConfig);

    // ✅ Perform S3 deletions in **parallel**
    const deleteResults = await Promise.allSettled(
      rows.map(({ key }) =>
        client.send(new DeleteObjectCommand({ Bucket: bucketConfig.name, Key: key }))
      )
    );

    // ✅ Only delete from DB if S3 deletions were successful
    const successfullyDeleted = deleteResults.filter(
      (result) => result.status === "fulfilled"
    ).length;

    if (successfullyDeleted > 0) {
      await query("DELETE FROM files WHERE id = ANY($1) AND bucket = $2", [fileIds, bucketConfig.name]);
    }

    return NextResponse.json({
      message: `Deleted ${successfullyDeleted} files successfully`,
      failedCount: fileIds.length - successfullyDeleted,
    });
  } catch (error) {
    console.error("Error deleting files:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
