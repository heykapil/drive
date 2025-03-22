import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { NextRequest, NextResponse } from "next/server";

interface FileUpdateRequest {
  fileId: number;
  rename?: string;
  liked?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");

    // Validate bucket parameter
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: "Bucket name not provided." },
        { status: 400 }
      );
    }

    // Validate bucket configuration
    const bucketConfig = buckets[bucket];
    if (!bucketConfig?.name) {
      return NextResponse.json(
        { success: false, error: "Invalid bucket specified." },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body: FileUpdateRequest = await req.json();
    if (!body.fileId) {
      return NextResponse.json(
        { success: false, error: "File ID is required." },
        { status: 400 }
      );
    }

    // Build SQL update statement dynamically based on the provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.rename !== undefined) {
      updates.push(`filename = $${paramIndex++}`);
      values.push(body.rename);
    }
    if (typeof body.liked === "boolean") {
      updates.push(`liked = $${paramIndex++}`);
      values.push(body.liked);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid update fields provided." },
        { status: 400 }
      );
    }

    // Add fileId for WHERE clause
    values.push(body.fileId);

    const sql = `UPDATE files SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *;`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "File not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating file:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
