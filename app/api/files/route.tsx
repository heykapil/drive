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
    const selectedBucketsParam = searchParams.get("bucket");
    const recent = searchParams.get("recent") === "true";
    const typeGroup = searchParams.get("typeGroup");
    const allFiles = !searchParams.get("limit") ? true : false;
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * limit;

    if (!selectedBucketsParam) {
      return NextResponse.json({ error: "No bucket selected" }, { status: 400 });
    }

    // Validate buckets
    const selectedBuckets = selectedBucketsParam
      .split(",")
      .map(b => b.trim())
      .filter(b => b);

    const validBuckets = selectedBuckets
      .filter(b => buckets[b] && buckets[b].name)
      .map(b => buckets[b].name);

    if (validBuckets.length === 0) {
      return NextResponse.json({ error: "No valid bucket selected" }, { status: 400 });
    }

    // Build WHERE conditions
    const whereConditions = [];
    const queryParams = [];

    // Always filter by bucket
    whereConditions.push("bucket = ANY($1)");
    queryParams.push(validBuckets);

    // Add search filter
    if (search) {
      whereConditions.push("filename ILIKE $2");
      queryParams.push(`%${search}%`);
    }

    // Add recent uploads filter
    if (recent) {
      whereConditions.push("uploaded_at >= NOW() - INTERVAL '1 week'");
    }

    // Add type group filter
    if (typeGroup) {
      switch (typeGroup) {
        case 'images':
          whereConditions.push("type LIKE 'image/%'");
          break;
        case 'documents':
          whereConditions.push("(type LIKE 'application/%' OR type LIKE 'text/%')");
          break;
        case 'videos':
          whereConditions.push("type LIKE 'video/%'");
          break;
      }
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

    const baseQuery = `
      SELECT id, filename, key, size, type, uploaded_at, is_public, bucket, liked
      FROM files
      WHERE ${whereConditions.join(" AND ")}
    `;

    // Fetch files
    const { rows } = await query(
      `${baseQuery}
       ORDER BY ${orderBy}
       LIMIT ${allFiles ? 'ALL' : '$' + (queryParams.length + 1)}
       OFFSET ${allFiles ? '0' : '$' + (queryParams.length + 2)}`,
      [
        ...queryParams,
        ...(allFiles ? [] : [limit, offset])
      ]
    );

    // Get total count
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM files WHERE ${whereConditions.join(" AND ")}`,
      queryParams
    );

    const totalFiles = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalFiles / limit);

    return NextResponse.json({
      files: rows.map(file => ({
        ...file,
        size: (file.size / 1024 / 1024).toFixed(1) + " MB" // Convert bytes to MB
      })),
      total: totalFiles,
      page,
      totalPages,
      limit
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { fileIds } = await req.json(); // Expecting multiple fileIds

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

    // Fetch all file keys in a single query.
    const { rows } = await query<{ key: string }>(
      "SELECT key FROM files WHERE id = ANY($1::int[]) AND bucket = $2",
      [fileIds, bucketConfig.name]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No matching files found" }, { status: 404 });
    }

    const client = await s3WithConfig(bucketConfig);

    // Perform S3 deletions in parallel.
    const deleteResults = await Promise.allSettled(
      rows.map(({ key }) =>
        client.send(new DeleteObjectCommand({ Bucket: bucketConfig.name, Key: key }))
      )
    );

    // Delete from DB only for successfully deleted items.
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
