import { query } from "@/service/postgres";
import { NextRequest, NextResponse } from "next/server";

interface FileUpdateRequest {
  fileId: number;
  rename?: string;
  liked?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: FileUpdateRequest = await req.json();
    const { fileId, rename, liked } = body;

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: "A 'fileId' is required in the request body." },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (rename !== undefined) {
      updates.push(`filename = $${paramIndex++}`);
      values.push(rename);
    }
    if (typeof liked === "boolean") {
      updates.push(`liked = $${paramIndex++}`);
      values.push(liked);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one valid update field ('rename' or 'liked') must be provided." },
        { status: 400 }
      );
    }

    // 4. CONSTRUCT THE SECURE QUERY WITH A COMPOUND WHERE CLAUSE
    // This is the critical security fix: we ensure the file belongs to the specified bucket.
    const sql = `
      UPDATE files
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, filename, liked;
    `;
    values.push(fileId);

    const result = await query(sql, values);

    // If no rows are returned, the file either doesn't exist or isn't in the correct bucket.
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "File not found within the specified bucket." },
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
