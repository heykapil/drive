import { query } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { bucketIds } = await req.json();
    if (!bucketIds || bucketIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid bucketIds' },
        { status: 400 },
      );
    }
    const statsQuery = `
      SELECT
          -- Cast all counts to INTEGER
          COUNT(*)::INT AS total_files,
          COUNT(*) FILTER (WHERE uploaded_at >= NOW() - INTERVAL '1 week')::INT AS last_week_files,
          COUNT(*) FILTER (WHERE type LIKE 'image/%')::INT AS total_images,
          COUNT(*) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%')::INT AS total_documents,
          COUNT(*) FILTER (WHERE type LIKE 'video/%')::INT AS total_videos,

          -- Cast all rounded numeric values to FLOAT
          ROUND((COUNT(*) FILTER (WHERE type LIKE 'image/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2)::FLOAT AS images_percent,
          ROUND((COUNT(*) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2)::FLOAT AS documents_percent,
          ROUND((COUNT(*) FILTER (WHERE type LIKE 'video/%') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2)::FLOAT AS videos_percent,
          ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'image/%'), 0) / 1073741824.0, 2)::FLOAT AS images_size_gb,
          ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'application/%' OR type LIKE 'text/%'), 0) / 1073741824.0, 2)::FLOAT AS documents_size_gb,
          ROUND(COALESCE(SUM(size) FILTER (WHERE type LIKE 'video/%'), 0) / 1073741824.0, 2)::FLOAT AS videos_size_gb
      FROM
          files
      WHERE
          bucket_id = ANY($1)
    `;

    const { rows } = await query(statsQuery, [bucketIds]);
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
      videos_size_gb: 0,
    };
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
