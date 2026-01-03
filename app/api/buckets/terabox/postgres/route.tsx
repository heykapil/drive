import { encryptSecret } from '@/lib/helpers/jose';
import { query, sql } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const {
            name,
            email,
            password,
            cookie,
            whost,
            accountId,
            accountName,
            isVip,
            vipType,
            spaceTotalBytes,
            folderId,
        } = await req.json();

        if (!folderId) {
            return NextResponse.json(
                { error: 'A folderId is required to create a Terabox bucket.' },
                { status: 400 },
            );
        }

        // Encrypt sensitive credentials before storing
        const email_encrypted = email ? await encryptSecret(email) : null;
        const password_encrypted = password ? await encryptSecret(password) : null;
        const cookie_encrypted = '';

        // Use a transaction to ensure all tables are updated correctly
        const newBucket = await sql.begin(async sql => {
            // 1. Insert into tb_auth_sessions
            const [session] = await sql`
                INSERT INTO tb_auth_sessions (
                    email,
                    email_encrypted,
                    password_encrypted,
                    cookie_encrypted,
                    whost,
                    cookie_expires_at,
                    user_agent_encrypted
                ) VALUES (
                    ${email || name}, -- Use name as email fallback if email missing? Or require email? schema says email NOT NULL. 
                    ${email_encrypted || ''}, 
                    ${password_encrypted || ''}, 
                    ${cookie || ''}, 
                    ${whost || 'terabox.com'}, 
                    NOW() + INTERVAL '30 days', -- Default expiry
                    ''
                )
                RETURNING id
            `;

            // 2. Insert into tb_account_info
            await sql`
                INSERT INTO tb_account_info (
                    id,
                    account_id,
                    account_name,
                    name,
                    is_vip,
                    vip_type,
                    space_total_bytes,
                    space_used_bytes,
                    updated_at
                ) VALUES (
                    ${session.id},
                    ${accountId || ''},
                    ${accountName || ''},
                    ${name},
                    ${isVip || false},
                    ${vipType || 0},
                    ${spaceTotalBytes || 0},
                    0,
                    NOW()
                )
            `;

            // 3. Insert into tb_buckets_backup (to satisfy FKs for now)
            // Note: tb_buckets_backup id is serial/sequence. It might NOT match session.id.
            // But if FKs point to it, we need it.
            // If we use session.id, we might conflict if tb_buckets_backup has its own sequence.
            // However, let's look at schema: id integer DEFAULT nextval('tb_buckets_id_seq').
            // If we force ID, we might be okay.
            // Let's TRY to use same ID.
            const [backup] = await sql`
                INSERT INTO tb_buckets_backup (
                    id,
                    email,
                    email_encrypted,
                    password_encrypted,
                    cookie_encrypted,
                    whost,
                    account_id,
                    account_name,
                    name,
                    is_vip,
                    vip_type,
                    space_used_bytes,
                    space_total_bytes,
                    cookie_expires_at,
                    updated_at
                ) VALUES (
                    ${session.id},
                    ${email || name},
                    ${email_encrypted || ''},
                    ${password_encrypted || ''},
                    ${cookie || ''},
                    ${whost || 'terabox.com'},
                    ${accountId || ''},
                    ${accountName || ''},
                    ${name},
                    ${isVip || false},
                    ${vipType || 0},
                    0,
                    ${spaceTotalBytes || 0},
                    NOW() + INTERVAL '30 days',
                    NOW()
                )
                RETURNING id
             `;

            // 4. Link the new bucket to the specified folder
            // Use backup.id (which should be session.id if forced)
            await sql`
                INSERT INTO folder_buckets (tb_bucket_id, folder_id, bucket_id)
                VALUES (${backup.id}, ${folderId}, NULL)
            `;

            return backup;
        });

        return NextResponse.json(
            {
                message: 'Terabox bucket created and linked successfully.',
                bucket: { id: newBucket.id },
            },
            { status: 201 },
        );
    } catch (error: any) {
        console.error('Error creating Terabox bucket:', error);
        if (error.code === '23505') {
            // Handle unique name constraint
            return NextResponse.json(
                { error: 'A Terabox bucket with this name already exists.' },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { error: 'Internal server error.' },
            { status: 500 },
        );
    }
}

// --- UPDATE a Terabox bucket's folder location ---
export async function PATCH(req: NextRequest) {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { bucketId, newFolderId } = (await req.json()) as {
            bucketId: number;
            newFolderId: number;
        };

        if (!bucketId || !newFolderId) {
            return NextResponse.json(
                { error: 'Both bucketId and newFolderId are required.' },
                { status: 400 },
            );
        }

        // This transaction guarantees data integrity
        await sql.begin(async sql => {
            // 1. Remove all existing folder associations for this Terabox bucket
            await sql`
        DELETE FROM folder_buckets WHERE tb_bucket_id = ${bucketId}
      `;

            // 2. Create the new association in the junction table
            await sql`
        INSERT INTO folder_buckets (tb_bucket_id, folder_id, bucket_id) 
        VALUES (${bucketId}, ${newFolderId}, NULL)
      `;
        });

        return NextResponse.json({
            message: `Terabox bucket ${bucketId} was successfully moved to folder ${newFolderId}.`,
        });
    } catch (error) {
        console.error('Error moving Terabox bucket:', error);
        return NextResponse.json(
            { error: 'Internal server error.' },
            { status: 500 },
        );
    }
}

export async function GET() {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { rows } = await query(
            `SELECT
            tb.id AS bucket_id,
            tb.account_id AS bucket_name,
            'Terabox' as provider,
            tb.account_name,
            tb.is_vip,
            tb.vip_type,
            tb.space_total_bytes AS total_capacity_bytes,
            tb.space_used_bytes AS storage_used_bytes,
            
            -- Calculate available storage in GB
            TRUNC(
              ((tb.space_total_bytes - tb.space_used_bytes) / (1024.0 * 1024 * 1024)),
              2
            ) AS available_storage_gb,

            -- Calculate usage percentage
            CASE
              WHEN tb.space_total_bytes > 0 THEN
                TRUNC(
                  (tb.space_used_bytes::decimal / tb.space_total_bytes * 100),
                  2
                )
              ELSE 0
            END AS usage_percentage,

            tb.updated_at,
            fb.folder_id,
            f.name AS folder_name,
            f.parent_id AS folder_parent_id
          FROM
            tb_buckets AS tb
          JOIN
            folder_buckets AS fb ON tb.id = fb.tb_bucket_id
          JOIN
            folders AS f ON fb.folder_id = f.id`,
        );
        return NextResponse.json({ buckets: rows });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Failed to fetch Terabox buckets' },
            { status: 500 },
        );
    }
}
