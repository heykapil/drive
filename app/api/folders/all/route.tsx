import { query } from "@/service/postgres";
import { NextResponse } from "next/server";

// This endpoint fetches the complete folder hierarchy.
export async function GET() {
  try {
    // It's important to get all folders to build the full tree structure on the client.
    const { rows } = await query("SELECT id, name, parent_id FROM folders ORDER BY name ASC");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching all folders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
