import { NextRequest, NextResponse } from "next/server";
import { query } from "@/service/postgres";
import { buckets } from "@/service/bucket.config";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const selectedBucketsParam = searchParams.get("bucket");

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

    // Get statistics
    const statsQuery = `
      SELECT
        COUNT(*) AS total_files,
        COUNT(*) FILTER (WHERE uploaded_at >= NOW() - INTERVAL '1 week') AS last_week_files,
        COUNT(*) FILTER (WHERE type LIKE 'image/%') AS total_images,
        COUNT(*) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%') AS total_documents,
        COUNT(*) FILTER (WHERE type LIKE 'video/%') AS total_videos,
        ROUND((COUNT(*) FILTER (WHERE type LIKE 'image/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2) AS images_percent,
        ROUND((COUNT(*) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2) AS documents_percent,
        ROUND((COUNT(*) FILTER (WHERE type LIKE 'video/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2) AS videos_percent,
        ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'image/%'), 0) / 1073741824.0, 2) AS images_size_gb,
        ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%'), 0) / 1073741824.0, 2) AS documents_size_gb,
        ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'video/%'), 0) / 1073741824.0, 2) AS videos_size_gb
      FROM files
      WHERE bucket = ANY($1)
    `;

    const { rows } = await query(statsQuery, [validBuckets]);
    const stats = rows[0] || {
      total_files: 0,
      last_week_files: 0,
      total_images: 0,
      total_documents: 0,
      total_videos: 0,
      images_percent: 0,
      documents_percent: 0,
      videos_percent: 0,
      images_size_gb: 0,
      documents_size_gb: 0,
      videos_size_gb: 0
    };
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
