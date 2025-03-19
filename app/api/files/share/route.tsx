import { SharedFile } from "@/app/shared/shared-files-table";
import { generateToken } from "@/lib/helpers/token";
import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    if (!bucket) {
      return NextResponse.json({ success: false, error: "Bucket name not provided" });
    }

    const bucketConfig = buckets[bucket];

    if (!bucketConfig?.name) {
      return NextResponse.json({ success: false, error: "Wrong bucket id provided" });
    }

    // ✅ Read and store the JSON request body
    const body = await req.json();
    const { fileId, duration } = body;

    if (!fileId || typeof duration !== "number") {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // ✅ Fetch file details from the database
    const { rows } = await query("SELECT * FROM files WHERE id = $1 AND bucket = $2", [
      fileId,
      bucketConfig.name,
    ]);
    if (!rows.length) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { id, filename, size, type } = rows[0];

    const expires = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    const token = generateToken(duration)

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/file?id=${fileId}&token=${token}`;

    await query(
      "INSERT INTO shared (token, id, filename, size, type, bucket, expires, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [token, id, filename, size, type, bucketConfig.name, expires, new Date()]
    );

    return NextResponse.json({ message: "File has been shared", url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest){
  try{
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "";

    if (!token) {
      return NextResponse.json({ success: false, error: "Token not provided" });
    }

    await query(`DELETE from shared WHERE token = $1`, [token])
    return NextResponse.json({success: true, message: 'Token deleted'})
  } catch(error: any){
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || '1', 10);
    const pageSize = parseInt(searchParams.get("pageSize") || '10', 10);

    // Validate pagination parameters
    if (isNaN(page) || isNaN(pageSize) || page < 0 || pageSize <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = page * pageSize;

    // Get total count
    const countQuery = "SELECT COUNT(*) FROM shared";
    const countResult = await query<{ count: string }>(countQuery);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const dataQuery = `SELECT * FROM shared ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

    const dataResult = await query<SharedFile>(dataQuery, [pageSize, offset]);
    // Convert dates to ISO strings
    const files = dataResult.rows.map(row => ({
      ...row,
      expires: row.expires ? new Date(row.expires).toISOString() : null,
      created_at: new Date(row.created_at).toISOString()
    }));

    // console.log({files, totalCount, countResult, offset, page, pageSize})

    return NextResponse.json({
      success: true,
      data: {
        files,
        totalCount
      }
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
