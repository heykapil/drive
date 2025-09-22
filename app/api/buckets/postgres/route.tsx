import { encryptSecret } from '@/lib/helpers/jose';
import { query, sql } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {
      name, region, endpoint, provider, total_capacity_gb,
      accessKey, secretKey, folderId
    } = await req.json();

    if (!folderId) {
      return NextResponse.json({ error: "A folderId is required to create a bucket." }, { status: 400 });
    }

    // Encrypt secrets before storing
    const access_key_encrypted = await encryptSecret(accessKey);
    const secret_key_encrypted = await encryptSecret(secretKey);

    // Use a transaction to ensure both the bucket and its folder link are created successfully
    const newBucket = await sql.begin(async (sql) => {
      // 1. Insert the new bucket details
      const [bucket] = await sql`
        INSERT INTO s3_buckets (name, region, endpoint, provider, total_capacity_gb, access_key_encrypted, secret_key_encrypted)
        VALUES (${name}, ${region}, ${endpoint}, ${provider}, ${total_capacity_gb}, ${access_key_encrypted}, ${secret_key_encrypted})
        RETURNING id
      `;

      // 2. Link the new bucket to the specified folder
      await sql`
        INSERT INTO folder_buckets (bucket_id, folder_id)
        VALUES (${bucket.id}, ${folderId})
      `;

      return bucket;
    });

    return NextResponse.json({
      message: "Bucket created and linked successfully.",
      bucket: { id: newBucket.id },
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating bucket:", error);
    if (error.code === '23505') { // Handle unique name constraint
      return NextResponse.json({ error: "A bucket with this name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}


// --- UPDATE a bucket's folder location ---
export async function PATCH(req: NextRequest) {
  try {
    const { bucketId, newFolderId } = (await req.json()) as { bucketId: number; newFolderId: number };

    if (!bucketId || !newFolderId) {
      return NextResponse.json({ error: "Both bucketId and newFolderId are required." }, { status: 400 });
    }

    // This transaction guarantees data integrity. It's automatically committed on success or rolled back on error.
    await sql.begin(async (sql) => {
      // 1. Remove all existing folder associations for this bucket
      await sql`
        DELETE FROM folder_buckets WHERE bucket_id = ${bucketId}
      `;

      // 2. Create the new association in the junction table
      await sql`
        INSERT INTO folder_buckets (bucket_id, folder_id) VALUES (${bucketId}, ${newFolderId})
      `;
    });

    return NextResponse.json({
      message: `Bucket ${bucketId} was successfully moved to folder ${newFolderId}.`,
    });

  } catch (error) {
    console.error("Error moving bucket:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}


export async function GET() {
  try {
    const { rows } = await query(
          `SELECT
            b.id AS bucket_id,
            b.name AS bucket_name,
            b.is_private AS private,
            b.provider,
            b.total_capacity_gb,
            b.storage_used_bytes,

            -- Calculate available storage in GB on the fly
            TRUNC(
              -- Cast to BIGINT before multiplication to prevent integer overflow
              ((b.total_capacity_gb::bigint * 1024 * 1024 * 1024) - b.storage_used_bytes) / (1024 * 1024 * 1024),
              2
            ) AS available_storage_gb,

            -- Calculate usage percentage
            CASE
              WHEN b.total_capacity_gb > 0 THEN
                TRUNC(
                  -- Using ::decimal for precision and ::bigint in denominator to prevent overflow
                  (b.storage_used_bytes::decimal / (b.total_capacity_gb::bigint * 1024 * 1024 * 1024) * 100),
                  2
                )
              ELSE 0
            END AS usage_percentage,

            b.updated_at,
            fb.folder_id,
            f.name AS folder_name,
            f.parent_id AS folder_parent_id
          FROM
            s3_buckets AS b
          JOIN
            folder_buckets AS fb ON b.id = fb.bucket_id
          JOIN
            folders AS f ON fb.folder_id = f.id`
        );
    return NextResponse.json({ buckets: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch buckets' }, { status: 500 });
  }
}
