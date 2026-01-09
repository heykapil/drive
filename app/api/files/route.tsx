import { getBucketConfig } from '@/service/bucket.config';
import { getTBBucketConfig } from '@/service/tb-bucket.config';
import { query } from '@/service/postgres';
import { s3WithConfig } from '@/service/s3-tebi';
import { deleteTBFiles } from '@/lib/actions/terabox';
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
    let validS3BucketIds: number[] = [];
    let validTBBucketIds: number[] = [];

    if (!bucketId) {
      // Fetch both S3 and Terabox bucket IDs from folder
      const { rows: bucketIdRows } = await query(
        'SELECT bucket_id, tb_bucket_id FROM folder_buckets WHERE folder_id = $1',
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

      validS3BucketIds = bucketIdRows
        .filter(row => row.bucket_id != null)
        .map(row => row.bucket_id);
      validTBBucketIds = bucketIdRows
        .filter(row => row.tb_bucket_id != null)
        .map(row => row.tb_bucket_id);
    } else {
      // Parse bucketId parameter which can be comma separated list of unified IDs (e.g. "s3_1,tb_2")
      // or legacy numeric IDs (assumed S3)
      const bucketIds = bucketId.split(',').map(id => id.trim());

      bucketIds.forEach(id => {
        if (id.startsWith('s3_')) {
          const numId = parseInt(id.replace('s3_', ''), 10);
          if (!isNaN(numId)) validS3BucketIds.push(numId);
        } else if (id.startsWith('tb_')) {
          const numId = parseInt(id.replace('tb_', ''), 10);
          if (!isNaN(numId)) validTBBucketIds.push(numId);
        } else {
          // Legacy numeric ID -> Assume S3
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) validS3BucketIds.push(numId);
        }
      });
    }

    const whereConditions = [];
    const queryParams: any[] = [];

    // Filter by bucket IDs - support both S3 and Terabox
    const bucketConditions = [];
    if (validS3BucketIds.length > 0) {
      bucketConditions.push(`f.bucket_id = ANY($${queryParams.length + 1})`);
      queryParams.push(validS3BucketIds);
    }
    if (validTBBucketIds.length > 0) {
      bucketConditions.push(`f.tb_bucket_id = ANY($${queryParams.length + 1})`);
      queryParams.push(validTBBucketIds);
    }

    if (bucketConditions.length > 0) {
      whereConditions.push(`(${bucketConditions.join(' OR ')})`);
    }

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

    // 3. Define a reusable base query with LEFT JOINs for both bucket types
    const baseQuery = `
      FROM files f
      LEFT JOIN s3_buckets b ON f.bucket_id = b.id
      LEFT JOIN tb_buckets tb ON f.tb_bucket_id = tb.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    // 4. Fetch the files for the current page
    const filesQuery = `
      SELECT 
        f.id, 
        f.filename, 
        f.key, 
        f.size, 
        f.type,
        f.thumbnail, 
        f.uploaded_at, 
        f.is_public, 
        f.liked,
        COALESCE(b.name, tb.name) as bucket,
        f.bucket_id,
        f.quality,
        f.duration,
        f.tb_bucket_id,
        f.share_id,
        CASE 
          WHEN f.bucket_id IS NOT NULL THEN 'S3'
          WHEN f.tb_bucket_id IS NOT NULL THEN 'TB'
        END as bucket_type
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

    // 1. Fetch file details from the database including bucket type and share_id
    const { rows: filesToDelete } = await query<{
      id: number;
      key: string;
      bucketId: number | null;
      tbBucketId: number | null;
      shareId: string | null;
    }>(
      `SELECT f.id, f.key, f.bucket_id AS "bucketId", f.tb_bucket_id AS "tbBucketId", f.share_id AS "shareId" 
       FROM files f 
       WHERE f.id = ANY($1::int[])`,
      [fileIds],
    );

    if (filesToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No matching files found for the given IDs' },
        { status: 404 },
      );
    }

    // 2. Group files by bucket type and bucket ID
    const s3FilesByBucket: Record<number, { id: number; key: string }[]> = {};
    const tbFilesByBucket: Record<number, { id: number; key: string; shareId?: string }[]> = {};

    filesToDelete.forEach(file => {
      if (file.bucketId != null) {
        // S3 bucket file
        if (!s3FilesByBucket[file.bucketId]) {
          s3FilesByBucket[file.bucketId] = [];
        }
        s3FilesByBucket[file.bucketId].push({ id: file.id, key: file.key });
      } else if (file.tbBucketId != null) {
        // Terabox bucket file
        if (!tbFilesByBucket[file.tbBucketId]) {
          tbFilesByBucket[file.tbBucketId] = [];
        }
        tbFilesByBucket[file.tbBucketId].push({
          id: file.id,
          key: file.key,
          shareId: file.shareId || undefined
        });
      }
    });

    const successfullyDeletedIds: number[] = [];
    const deletionPromises = [];

    // 3. Handle S3 bucket deletions
    const uniqueS3BucketIds = Object.keys(s3FilesByBucket).map(Number);
    if (uniqueS3BucketIds.length > 0) {
      const bucketConfigs = await getBucketConfig(uniqueS3BucketIds);
      const configMap = new Map(bucketConfigs.map(config => [config.id, config]));

      for (const bucketId of uniqueS3BucketIds) {
        const bucketConfig = configMap.get(bucketId);
        const filesInBucket = s3FilesByBucket[bucketId];

        if (!bucketConfig) {
          console.error(
            `S3 configuration for bucket ID ${bucketId} not found. Skipping ${filesInBucket.length} files.`,
          );
          continue;
        }

        const client = await s3WithConfig(bucketConfig);

        // S3's DeleteObjectsCommand can handle up to 1000 keys per request.
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < filesInBucket.length; i += CHUNK_SIZE) {
          const chunk = filesInBucket.slice(i, i + CHUNK_SIZE);

          const deleteParams = {
            Bucket: bucketConfig.name,
            Delete: {
              Objects: chunk.map(({ key }) => ({ Key: key })),
            },
          };

          const command = new DeleteObjectsCommand(deleteParams);

          const promise = client
            .send(command)
            .then(output => {
              const failedKeys = new Set(output.Errors?.map(err => err.Key));
              chunk.forEach(file => {
                if (!failedKeys.has(file.key)) {
                  successfullyDeletedIds.push(file.id);
                } else {
                  console.error(
                    `Failed to delete key ${file.key} from S3 bucket ${bucketConfig.name}`,
                  );
                }
              });
            })
            .catch(error => {
              console.error(
                `Batch delete failed for S3 bucket ${bucketConfig.name}:`,
                error,
              );
            });

          deletionPromises.push(promise);
        }
      }
    }

    // 4. Handle Terabox bucket deletions
    const uniqueTBBucketIds = Object.keys(tbFilesByBucket).map(Number);
    if (uniqueTBBucketIds.length > 0) {
      for (const bucketId of uniqueTBBucketIds) {
        const filesInBucket = tbFilesByBucket[bucketId];
        const fileKeys = filesInBucket.map(f => f.key);
        const promise = deleteTBFiles(bucketId, fileKeys)
          .then(result => {
            // Mark successfully deleted files
            filesInBucket.forEach(file => {
              if (result.deleted.includes(file.key)) {
                successfullyDeletedIds.push(file.id);
              } else {
                console.error(
                  `Failed to delete key ${file.key} from Terabox bucket ${bucketId}`,
                );
              }
            });
          })
          .catch(error => {
            console.error(
              `Batch delete failed for Terabox bucket ${bucketId}:`,
              error,
            );
          });

        deletionPromises.push(promise);
      }
    }

    // 5. Wait for all deletion operations (S3 and Terabox) to complete
    await Promise.all(deletionPromises);

    // 6. Atomically delete records from the database ONLY for files successfully deleted from cloud storage
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
