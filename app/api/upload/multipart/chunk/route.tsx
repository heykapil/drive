import { getBucketConfig } from "@/service/bucket.config";
import { s3WithConfig } from "@/service/s3-tebi";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucketIdParam = searchParams.get("bucket");

    const bucketId = bucketIdParam ? parseInt(bucketIdParam, 10) : NaN;

    if (!bucketId || isNaN(bucketId) || bucketId <= 0) {
        return NextResponse.json({
          success: false,
          error: "Bucket ID must be a positive integer",
        });
      }

    const bucketConfigArray = await getBucketConfig(bucketId)

    if(bucketConfigArray.length===0){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const bucketConfig = bucketConfigArray[0];

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    // Parse multipart/form-data
    const formData = await req.formData();
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = parseInt(formData.get("partNumber") as string);
    const chunk = formData.get("chunk") as Blob;

    // Validate required fields
    if (!uploadId || !key || !partNumber || !chunk) {
      console.error( "Missing required fields", {
        uploadId,
        key,
        partNumber,
        chunk
      })
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
      console.error({ error: "Missing ETag in upload response", response });
      throw new Error("Missing ETag in upload response");
    }

    return NextResponse.json({
      success: true,
      ETag: response.ETag.replace(/"/g, ""),
    });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json(
      { success: false, error: error || "Chunk upload failed" },
      { status: 500 }
    );
  }
}
