import { query } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { files } = body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return NextResponse.json({ error: 'No files provided to sync' }, { status: 400 });
        }

        // files is an array of { key, size, bucketId, ... }

        const insertedFiles = [];
        const errors = [];

        for (const file of files) {
            try {
                // Basic validation
                if (!file.key || !file.bucketId) {
                    throw new Error('Missing key or bucketId');
                }

                // Determine filename from key (simple split)
                const filename = file.key.split('/').pop() || file.key;

                // Determine type (extension)
                const type = filename.split('.').pop() || 'unknown';

                // Insert into Postgres
                // We use ON CONFLICT DO NOTHING to avoid errors if the file was added concurrently
                // schema: filename, "key", "size", "type", bucket_id, is_public (default false), liked (default false)
                const { rows } = await query(
                    `INSERT INTO files (filename, "key", "size", "type", bucket_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("key") DO NOTHING
           RETURNING id`,
                    [filename, file.key, file.size || 0, type, file.bucketId]
                );

                if (rows.length > 0) {
                    insertedFiles.push({ ...file, id: rows[0].id });
                } else {
                    // If no row returned, it might be a duplicate key.
                    // We can consider it "synced" or "already exists".
                    insertedFiles.push({ ...file, status: 'already_exists' });
                }

            } catch (err: any) {
                console.error(`Error syncing file ${file.key}:`, err);
                errors.push({ key: file.key, error: err.message });
            }
        }

        return NextResponse.json({
            message: `Processed ${files.length} files`,
            syncedCount: insertedFiles.length,
            errors
        });

    } catch (error: any) {
        console.error('Error in sync API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
