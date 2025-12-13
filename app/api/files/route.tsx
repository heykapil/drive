import { getBucketConfig } from '@/service/bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    const bucketId = searchParams.get('bucketId');
    if (!folderId && !bucketId) {
      return NextResponse.json(
        { error: 'No folder or bucket selected' },
        { status: 400 },
      );
    }

    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'uploaded_at_desc';
    const recent = searchParams.get('recent') === 'true';
    const typeGroup = searchParams.get('typeGroup');
    const liked = searchParams.get('liked');
    const is_public = searchParams.get('public');
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;
    let validBucketIds = [];

    if (!bucketId) {
      const { rows: bucketIdRows } = await query(
        'SELECT bucket_id FROM folder_buckets WHERE folder_id = $1',
        [folderId],
      );

      if (bucketIdRows.length === 0) {
        // If the folder has no buckets, it has no files. Return an empty result.
        return NextResponse.json({
          files: [],
          total: 0,
          page: 1,
          totalPages: 0,
          limit,
        });
      }
      validBucketIds = bucketIdRows.map(row => row.bucket_id);
    } else {
      validBucketIds = bucketId
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
    }

    const whereConditions = [];
    const queryParams: any[] = [];

    // Always filter by the bucket IDs from the folder
    whereConditions.push(`f.bucket_id = ANY($${queryParams.length + 1})`);
    queryParams.push(validBucketIds);

    // Add search filter
    if (search) {
      whereConditions.push(`f.filename ILIKE $${queryParams.length + 1}`);
      queryParams.push(`%${search}%`);
    }

    // Add recent uploads filter
    if (recent) {
      whereConditions.push("f.uploaded_at >= NOW() - INTERVAL '1 week'");
    }

    // Add public/private filter (using parameters, not string interpolation)
    if (is_public) {
      whereConditions.push(`f.is_public = $${queryParams.length + 1}`);
      queryParams.push(is_public === 'true');
    }

    // Add liked filter (using parameters)
    if (liked) {
      whereConditions.push(`f.liked = $${queryParams.length + 1}`);
      queryParams.push(liked === 'true');
    }

    if (typeGroup) {
      switch (typeGroup) {
        case 'images':
          whereConditions.push("f.type LIKE 'image/%'");
          break;
        case 'documents':
          whereConditions.push(
            "(f.type LIKE 'application/%' OR f.type LIKE 'text/%')",
          );
          break;
        case 'videos':
          whereConditions.push("f.type LIKE 'video/%'");
          break;
      }
    }

    const sortOptions: Record<string, string> = {
      name_asc: 'f.filename ASC',
      name_desc: 'f.filename DESC',
      size_asc: 'f.size ASC',
      size_desc: 'f.size DESC',
      type_asc: 'f.type ASC',
      type_desc: 'f.type DESC',
      uploaded_at_asc: 'f.uploaded_at ASC',
      uploaded_at_desc: 'f.uploaded_at DESC',
      liked_asc: 'f.liked ASC',
      liked_desc: 'f.liked DESC',
      public_asc: 'f.is_public ASC',
      public_desc: 'f.is_public DESC',
    };

    const orderBy = sortOptions[sort] || 'f.uploaded_at DESC';

    // 3. Define a reusable base query with the necessary JOIN
    const baseQuery = `
      FROM files f
      JOIN s3_buckets b ON f.bucket_id = b.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    // 4. Fetch the files for the current page
    const filesQuery = `
      SELECT f.id, f.filename, f.key, f.size, f.type, f.uploaded_at, f.is_public, f.liked, b.name as bucket
      ${baseQuery}
      ORDER BY ${orderBy}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    const { rows } = await query(filesQuery, [...queryParams, limit, offset]);

    // 5. Get the total count using the SAME base query to fix the error
    const countQuery = `SELECT COUNT(*)::int AS total ${baseQuery}`;
    const { rows: countRows } = await query(countQuery, queryParams);

    const totalFiles = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalFiles / limit);

    return NextResponse.json({
      files: rows,
      total: totalFiles,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { fileIds } = await req.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one file ID is required' },
        { status: 400 },
      );
    }

    // 1. Fetch file details from the database
    const { rows: filesToDelete } = await query<{
      id: number;
      key: string;
      bucketId: number;
    }>(
      `SELECT f.id, f.key, f.bucket_id AS "bucketId" FROM files f WHERE f.id = ANY($1::int[])`,
      [fileIds],
    );

    if (filesToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No matching files found for the given IDs' },
        { status: 404 },
      );
    }

    // 2. Group files by bucket for batch processing
    const filesByBucket = filesToDelete.reduce(
      (acc, file) => {
        (acc[file.bucketId] = acc[file.bucketId] || []).push({
          id: file.id,
          key: file.key,
        });
        return acc;
      },
      {} as Record<number, { id: number; key: string }[]>,
    );

    // 3. EFFICIENTLY fetch all required bucket configurations at once
    const uniqueBucketIds = Object.keys(filesByBucket).map(Number);
    const bucketConfigs = await getBucketConfig(uniqueBucketIds);

    // Create a Map for quick lookups: bucketId -> BucketConfig
    const configMap = new Map(bucketConfigs.map(config => [config.id, config]));

    const successfullyDeletedIds: number[] = [];
    const deletionPromises = [];

    // 4. Iterate over each bucket and perform BATCH deletions from S3
    for (const bucketId of uniqueBucketIds) {
      const bucketConfig = configMap.get(bucketId);
      const filesInBucket = filesByBucket[bucketId];

      if (!bucketConfig) {
        console.error(
          `Configuration for bucket ID ${bucketId} not found. Skipping ${filesInBucket.length} files.`,
        );
        continue;
      }

      const client = await s3WithConfig(bucketConfig);

      // S3's DeleteObjectsCommand can handle up to 1000 keys per request.
      // We must "chunk" our deletions if we have more than 1000 files in a single bucket.
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < filesInBucket.length; i += CHUNK_SIZE) {
        const chunk = filesInBucket.slice(i, i + CHUNK_SIZE);

        const deleteParams = {
          Bucket: bucketConfig.name,
          Delete: {
            Objects: chunk.map(({ key }) => ({ Key: key })),
          },
        };

        // 1. Create the command instance first
        const command = new DeleteObjectsCommand(deleteParams);

        // 2. THIS IS THE FIX: Add a middleware to disable flexible checksums
        // command.middlewareStack.add(
        //   (next, context) => (args) => {
        //     context.disableFlexibleChecksums = true;
        //     return next(args);
        //   },
        //   {
        //     step: "initialize",
        //     name: "disableFlexibleChecksumsMiddleware",
        //   }
        // );

        // 3. Send the modified command and push the promise
        const promise = client
          .send(command)
          .then(output => {
            // ... your existing .then() logic is unchanged ...
            const failedKeys = new Set(output.Errors?.map(err => err.Key));
            chunk.forEach(file => {
              if (!failedKeys.has(file.key)) {
                successfullyDeletedIds.push(file.id);
              } else {
                console.error(
                  `Failed to delete key ${file.key} from bucket ${bucketConfig.name}`,
                );
              }
            });
          })
          .catch(error => {
            console.error(
              `Batch delete failed for bucket ${bucketConfig.name}:`,
              error,
            );
          });

        deletionPromises.push(promise);
      }
    }

    // Wait for all S3 deletion operations (across all buckets and chunks) to complete
    await Promise.all(deletionPromises);

    // 5. Atomically delete records from the database ONLY for files successfully deleted from S3
    if (successfullyDeletedIds.length > 0) {
      await query('DELETE FROM files WHERE id = ANY($1::int[])', [
        successfullyDeletedIds,
      ]);
    }

    return NextResponse.json(
      {
        message: 'Operation complete.',
        deletedCount: successfullyDeletedIds.length,
        failedCount: fileIds.length - successfullyDeletedIds.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error deleting files:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
