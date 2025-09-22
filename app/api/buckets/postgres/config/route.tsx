import { BucketConfig } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { bucketIds } = await req.json();

  if (!Array.isArray(bucketIds) || bucketIds.length === 0) {
    return NextResponse.json({ error: "At least one bucket ID is required" }, { status: 400 });
  }

  const { rows } = await query("SELECT * FROM s3_buckets AS b WHERE b.id = ANY($1::int[])", [bucketIds]);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
  }

  const bucketConfigs: BucketConfig[] = rows.map((bucket) => {
    const {
      name,
      access_key_encrypted,
      secret_key_encrypted,
      region,
      id,
      endpoint,
      is_private,
      provider,
      available_capacity_gb,
    } = bucket;

    return {
      id,
      name,
      accessKey: access_key_encrypted,
      secretKey: secret_key_encrypted,
      region,
      endpoint,
      availableCapacity: available_capacity_gb,
      private: is_private,
      provider,
    };
  });

  return new Response(JSON.stringify(bucketConfigs), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
