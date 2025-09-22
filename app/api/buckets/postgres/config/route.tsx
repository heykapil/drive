import { getBucketConfig } from "@/service/bucket.config"; // Import the new function
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { bucketIds } = await req.json();

    if (!Array.isArray(bucketIds) || bucketIds.length === 0) {
      return NextResponse.json({ error: "At least one bucket ID is required" }, { status: 400 });
    }

    // Call the reusable server function
    const bucketConfigs = await getBucketConfig(bucketIds);

    if (bucketConfigs.length === 0) {
      return NextResponse.json({ error: "No buckets found for the given IDs" }, { status: 404 });
    }

    return NextResponse.json(bucketConfigs, { status: 200 });

  } catch (error) {
    console.error("Error fetching bucket configs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
