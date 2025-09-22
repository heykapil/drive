import { getBucketConfig } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi"; // Assuming this is the correct path
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const expiresIn = Math.max(60, parseInt(searchParams.get("expiresIn") || "300", 10));

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    console.log(`https://en.wikipedia.org/wiki/Generation Step 1: Fetching file info for ID: ${fileId}`);
    const { rows } = await query("SELECT key, bucket_id FROM files WHERE id = $1", [fileId]);

    if (rows.length === 0) {
      console.error(`https://en.wikipedia.org/wiki/Generation Error: File not found for ID: ${fileId}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.log("https://en.wikipedia.org/wiki/Generation Step 2: File info found:", rows[0]);


    const bucketId = rows[0].bucket_id;
    console.log(`https://en.wikipedia.org/wiki/Generation Step 3: Fetching bucket config for bucket ID: ${bucketId}`);
    const bucketConfigArray = await getBucketConfig(bucketId); // Assuming getBucketConfig returns an array

    if (!bucketConfigArray || bucketConfigArray.length === 0) {
        console.error(`https://en.wikipedia.org/wiki/Generation CRITICAL ERROR: Bucket config not found for bucket ID: ${bucketId}`);
        return NextResponse.json({ error: `Configuration for bucket ${bucketId} not found` }, { status: 500 });
    }
    const bucketConfig = bucketConfigArray[0];
    console.log("https://en.wikipedia.org/wiki/Generation Step 4: Bucket config found:", { id: bucketConfig.id, name: bucketConfig.name, provider: bucketConfig.provider });


    console.log("https://en.wikipedia.org/wiki/Generation Step 5: Creating S3 client with config.");
    const client = await s3WithConfig(bucketConfig);
    console.log("https://en.wikipedia.org/wiki/Generation Step 6: S3 client created successfully.");


    const command = new GetObjectCommand({ Bucket: bucketConfig.name, Key: rows[0].key });
    console.log("https://en.wikipedia.org/wiki/Generation Step 7: Generating signed URL...");
    const url = await getSignedUrl(client, command, { expiresIn: expiresIn });
    console.log("https://en.wikipedia.org/wiki/Generation Step 8: Signed URL generated successfully.");

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    // Log the specific error name and message for better debugging
    if (error instanceof Error) {
        console.error("Error Details:", { name: error.name, message: error.message, stack: error.stack });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
