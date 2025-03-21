import { buckets } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";

    // Validate bucket
    const bucketConfig = buckets[bucket];
    if (!bucketConfig?.name) {
      return NextResponse.json(
        { success: false, error: "Invalid bucket configuration" },
        { status: 400 }
      );
    }

    // Parse multipart/form-data
    const formData = await req.formData();
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = parseInt(formData.get("partNumber") as string);
    const chunk = formData.get("chunk") as Blob;

    // Validate required fields
    if (!uploadId || !key || !partNumber || !chunk) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

    // Upload part directly using SDK
    const client = await s3WithConfig(bucketConfig);
    const command = new UploadPartCommand({
      Bucket: bucketConfig.name,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunkBuffer,
    });

    const response = await client.send(command);

    if (!response.ETag) {
      throw new Error("Missing ETag in upload response");
    }

    return NextResponse.json({
      success: true,
      ETag: response.ETag.replace(/"/g, ""),
    });
  } catch (error: any) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Chunk upload failed" },
      { status: 500 }
    );
  }
}
