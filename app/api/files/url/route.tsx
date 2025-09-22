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

    const { rows } = await query("SELECT key, bucket_id FROM files WHERE id = $1", [fileId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }


    const bucketId = rows[0].bucket_id;
    const bucketConfigArray = await getBucketConfig(bucketId); // Assuming getBucketConfig returns an array

    if (!bucketConfigArray || bucketConfigArray.length === 0) {
        return NextResponse.json({ error: `Configuration for bucket ${bucketId} not found` }, { status: 500 });
    }
    const bucketConfig = bucketConfigArray[0];


    const client = await s3WithConfig(bucketConfig);


    const command = new GetObjectCommand({ Bucket: bucketConfig.name, Key: rows[0].key });
    const url = await getSignedUrl(client, command, { expiresIn: expiresIn });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error) {
        console.error("Error Details:", { name: error.name, message: error.message, stack: error.stack });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
