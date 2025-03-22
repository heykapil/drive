import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

interface RequestBody {
  fileIds: string[];
  bucket: string;
  expiresIn?: number;
}

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const { fileIds, bucket, expiresIn = 300 }: RequestBody = await req.json();

    if (!fileIds?.length) {
      return NextResponse.json(
        { success: false, error: "At least one file ID is required" },
        { status: 400 }
      );
    }

    if (!bucket) {
      return NextResponse.json(
        { success: false, error: "Bucket name not provided" },
        { status: 400 }
      );
    }

    const bucketConfig = buckets[bucket];
    if (!bucketConfig?.name) {
      return NextResponse.json(
        { success: false, error: "Invalid bucket configuration" },
        { status: 400 }
      );
    }

    // Validate expiresIn
    const validatedExpiresIn = Math.max(60, Math.min(expiresIn, 604800)); // 1 min to 7 days

    // Get all file keys in a single query
    const { rows } = await query(
      "SELECT id, key FROM files WHERE id = ANY($1) AND bucket = $2",
      [fileIds, bucketConfig.name]
    );

    // Create mapping for quick lookup
    const fileKeyMap = new Map(rows.map((row) => [row.id, row.key]));
    const notFound: string[] = [];
    const client = await s3WithConfig(bucketConfig);

    // Generate URLs in parallel
    const presignedUrls = await Promise.all(
      fileIds.map(async (fileId) => {
        if (!fileKeyMap.has(fileId)) {
          notFound.push(fileId);
          return null;
        }

        try {
          const command = new GetObjectCommand({
            Bucket: bucketConfig.name,
            Key: fileKeyMap.get(fileId),
          });

          const url = await getSignedUrl(client, command, {
            expiresIn: validatedExpiresIn,
          });

          return { fileId, url };
        } catch (error) {
          console.error(`Error generating URL for ${fileId}:`, error);
          return { fileId, error: "Failed to generate URL" };
        }
      })
    );

    // Filter successful results
    const successfulUrls = presignedUrls.filter(
      (item): item is { fileId: string; url: string } =>
        !!item && "url" in item
    );

    return NextResponse.json({
      success: true,
      presignedUrls: successfulUrls,
      ...(notFound.length && {
        notFound,
        warning: "Some files were not found",
      }),
    });
  } catch (error) {
    console.error("Error generating signed URLs:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
