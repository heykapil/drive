import { getBucketConfig } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { PutObjectAclCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

interface RequestBody {
  fileIds: (number | string)[]; // Allow mixed types initially for robust parsing
  isPublic: boolean;
}

// Define a clear type for the response items
type UpdateResult = {
  fileId: number;
  status: 'updated' | 'failed' | 'notFound';
  error?: string;
};

export async function PATCH(req: NextRequest) {
  try {
    // 1. PARSE AND VALIDATE THE REQUEST BODY
    const body: RequestBody = await req.json();

    if (!Array.isArray(body.fileIds) || body.fileIds.length === 0 || typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid request: 'fileIds' must be a non-empty array and 'isPublic' must be a boolean." },
        { status: 400 }
      );
    }

    const { isPublic } = body;
    // Sanitize and deduplicate input file IDs to prevent type inconsistencies and duplicate processing.
    // This ensures all IDs are numbers and that we only process each unique ID once.
    const uniqueNumericFileIds = [...new Set(body.fileIds.map(id => Number(id)))];

    // Check for NaN values which would indicate a parsing error for a non-numeric ID.
    if (uniqueNumericFileIds.some(isNaN)) {
      return NextResponse.json(
        { success: false, error: "Invalid request: 'fileIds' must contain only numbers or numeric strings." },
        { status: 400 }
      );
    }

    // Initialize a map to track the status of each requested file ID.
    // By default, all are considered 'notFound' until proven otherwise.
    const resultsMap = new Map<number, UpdateResult>();
    uniqueNumericFileIds.forEach(id => resultsMap.set(id, { fileId: id, status: 'notFound' }));

    // 2. FETCH FILE DETAILS FROM THE DATABASE
    const { rows: fileRecords } = await query<{ id: number; key: string; bucketId: number }>(
      "SELECT id, key, bucket_id AS \"bucketId\" FROM files WHERE id = ANY($1::int[])",
      [uniqueNumericFileIds] // Use the sanitized array
    );

    // If no records are found from the DB, all files were indeed not found. Return the initial results.
    if (fileRecords.length === 0) {
      return NextResponse.json({
        success: true,
        results: Array.from(resultsMap.values())
      });
    }

    // 3. GROUP THE *FOUND* FILES BY BUCKET FOR EFFICIENT PROCESSING
    const filesByBucket = fileRecords.reduce((acc, file) => {
      (acc[file.bucketId] = acc[file.bucketId] || []).push({ id: file.id, key: file.key });
      return acc;
    }, {} as Record<number, { id: number; key: string }[]>);

    // 4. FETCH ALL NECESSARY BUCKET CONFIGS AT ONCE
    const uniqueBucketIds = Object.keys(filesByBucket).map(Number);
    const bucketConfigs = await getBucketConfig(uniqueBucketIds);
    const configMap = new Map(bucketConfigs.map(config => [config.id, config]));

    // 5. UPDATE S3 OBJECT ACLs, UPDATING THE RESULTS MAP AS WE GO
    const aclUpdatePromises = [];
    for (const bucketId of uniqueBucketIds) {
      const config = configMap.get(bucketId);
      const filesInBucket = filesByBucket[bucketId];

      // If a bucket's config is missing, mark all files within it as failed.
      if (!config) {
        const errorMessage = `Missing configuration for bucketId: ${bucketId}.`;
        console.error(errorMessage);
        filesInBucket.forEach(file => {
          resultsMap.set(file.id, { fileId: file.id, status: 'failed', error: errorMessage });
        });
        continue;
      }

      // Process all files for this bucket in parallel
      const promise = Promise.all(
        filesInBucket.map(async (file) => {
          try {
            const command = new PutObjectAclCommand({
              Bucket: config.name,
              Key: file.key,
              ACL: isPublic ? "public-read" : "private",
            });
            await s3WithConfig(config).then(client => client.send(command));
            // On success, update the map for this file.
            resultsMap.set(file.id, { fileId: file.id, status: 'updated' });
          } catch (error: any) {
            const errorMessage = error.message || "Failed to update ACL in S3";
            console.error(`Failed to update ACL for fileId ${file.id}:`, error);
            // On failure, update the map with a specific error.
            resultsMap.set(file.id, { fileId: file.id, status: 'failed', error: errorMessage });
          }
        })
      );
      aclUpdatePromises.push(promise);
    }

    // Wait for all S3 operations to complete
    await Promise.all(aclUpdatePromises);

    // 6. UPDATE DATABASE ONLY FOR FILES THAT WERE SUCCESSFULLY UPDATED IN S3
    const successfullyUpdatedIds = Array.from(resultsMap.values())
      .filter(r => r.status === 'updated')
      .map(r => r.fileId);

    if (successfullyUpdatedIds.length > 0) {
      await query(
        `UPDATE files SET is_public = $1 WHERE id = ANY($2::int[])`,
        [isPublic, successfullyUpdatedIds]
      );
    }

    // 7. COMPILE AND RETURN THE FINAL, UNAMBIGUOUS RESPONSE
    return NextResponse.json({
      success: true,
      results: Array.from(resultsMap.values()),
    });

  } catch (error) {
    console.error("Error updating file ACL:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
