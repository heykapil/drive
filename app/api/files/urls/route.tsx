import { getBucketConfig } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

interface RequestBody {
  // Database IDs are typically numbers. Using numbers is more robust.
  fileIds: number[];
  expiresIn?: number; // Expiration time in seconds
}

export async function POST(req: NextRequest) {
  try {
    // 1. PARSE AND VALIDATE THE REQUEST BODY
    const { fileIds, expiresIn = 3600 }: RequestBody = await req.json(); // Default to 1 hour

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'An array of file IDs is required.' },
        { status: 400 },
      );
    }

    // Sanitize expiration to be between 1 minute and 7 days
    const validatedExpiresIn = Math.max(60, Math.min(expiresIn, 604800));

    // 2. FETCH ALL FILE DETAILS IN A SINGLE DATABASE QUERY
    const { rows: fileRecords } = await query<{
      id: number;
      key: string;
      bucketId: number;
    }>(
      'SELECT id, key, bucket_id AS "bucketId" FROM files WHERE id = ANY($1::int[])',
      [fileIds],
    );

    // Identify which requested files were not found in the database
    const foundIds = new Set(fileRecords.map(file => file.id));
    const notFoundIds = fileIds.filter(id => !foundIds.has(id));

    if (fileRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'None of the requested files were found.',
          notFound: notFoundIds,
        },
        { status: 404 },
      );
    }

    // 3. GROUP FILES BY BUCKET ID FOR EFFICIENT PROCESSING
    const filesByBucket = fileRecords.reduce(
      (acc, file) => {
        (acc[file.bucketId] = acc[file.bucketId] || []).push({
          id: file.id,
          key: file.key,
        });
        return acc;
      },
      {} as Record<number, { id: number; key: string }[]>,
    );

    // 4. FETCH ALL NECESSARY BUCKET CONFIGS AT ONCE
    const uniqueBucketIds = Object.keys(filesByBucket).map(Number);
    const bucketConfigs = await getBucketConfig(uniqueBucketIds);
    const configMap = new Map(bucketConfigs.map(config => [config.id, config]));

    // 5. GENERATE SIGNED URLS IN PARALLEL FOR EACH BUCKET
    const urlGenerationPromises = [];
    for (const bucketId of uniqueBucketIds) {
      const config = configMap.get(bucketId);
      const filesInBucket = filesByBucket[bucketId];

      if (!config) {
        console.error(
          `Missing configuration for bucketId: ${bucketId}. Cannot generate URLs for ${filesInBucket.length} files.`,
        );
        // Add these files to a 'failed' list
        continue;
      }

      const promise = (async () => {
        const client = await s3WithConfig(config);
        // Generate all URLs for this bucket in parallel
        return Promise.all(
          filesInBucket.map(async file => {
            try {
              const command = new GetObjectCommand({
                Bucket: config.name,
                Key: file.key,
              });
              const url = await getSignedUrl(client, command, {
                expiresIn: validatedExpiresIn,
              });
              return { fileId: file.id, url, status: 'success' as const };
            } catch (error) {
              console.error(
                `Error generating URL for fileId ${file.id} in bucket ${config.name}:`,
                error,
              );
              return {
                fileId: file.id,
                error: 'Failed to generate URL',
                status: 'error' as const,
              };
            }
          }),
        );
      })();
      urlGenerationPromises.push(promise);
    }

    // Wait for all URLs to be generated
    const resultsNested = await Promise.all(urlGenerationPromises);
    const results = resultsNested.flat(); // Flatten the array of arrays

    // 6. COMPILE THE FINAL RESPONSE
    const successfulUrls = results.filter(r => r.status === 'success');
    const failedUrls = results.filter(r => r.status === 'error');

    return NextResponse.json({
      success: true,
      presignedUrls: successfulUrls,
      ...(notFoundIds.length > 0 && { notFound: notFoundIds }),
      ...(failedUrls.length > 0 && { failed: failedUrls }),
    });
  } catch (error) {
    console.error('Internal server error in POST /api/files/urls:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
