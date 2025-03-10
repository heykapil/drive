import { signJWT } from "@/lib/helpers/jose";
import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { JWTPayload } from "jose";
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

    // ✅ Generate the token
    const payload = { id: fileId, duration, bucket } as JWTPayload;
    const token = await signJWT(payload, `${duration} d`);

    const expires = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/file?id=${fileId}&token=${token}`;

    // ✅ Insert into the shared table
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
