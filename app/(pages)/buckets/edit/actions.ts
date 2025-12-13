'use server';

import { getSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/helpers/jose";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

export interface BucketDetails {
    id: number;
    name: string;
    provider: string;
    region: string;
    endpoint: string;
    total_capacity_gb: number;
}

export interface UpdateBucketInput {
    id: number;
    name: string;
    provider: string;
    region: string;
    endpoint: string;
    total_capacity_gb: number;
    accessKey?: string;
    secretKey?: string;
}

export async function getBucketDetails(bucketId: number): Promise<BucketDetails | null> {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        throw new Error('Unauthorized');
    }

    const { rows } = await query(
        `SELECT id, name, provider, region, endpoint, total_capacity_gb 
     FROM s3_buckets WHERE id = $1`,
        [bucketId]
    );

    if (rows.length === 0) return null;

    return rows[0] as BucketDetails;
}

export async function updateBucket(input: UpdateBucketInput) {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        throw new Error('Unauthorized');
    }

    // Build the dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);

    updates.push(`provider = $${paramIndex++}`);
    values.push(input.provider);

    updates.push(`region = $${paramIndex++}`);
    values.push(input.region);

    updates.push(`endpoint = $${paramIndex++}`);
    values.push(input.endpoint);

    updates.push(`total_capacity_gb = $${paramIndex++}`);
    values.push(input.total_capacity_gb);

    updates.push(`updated_at = NOW()`);

    if (input.accessKey && input.secretKey) {
        const encryptedAccessKey = await encryptSecret(input.accessKey);
        const encryptedSecretKey = await encryptSecret(input.secretKey);

        updates.push(`access_key_encrypted = $${paramIndex++}`);
        values.push(encryptedAccessKey);

        updates.push(`secret_key_encrypted = $${paramIndex++}`);
        values.push(encryptedSecretKey);
    }

    values.push(input.id); // Add ID as the last parameter

    const sql = `UPDATE s3_buckets SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    await query(sql, values);

    return { success: true };
}

export async function verifyBucketConfig(config: UpdateBucketInput & { accessKey: string; secretKey: string }) {
    const session = await getSession();
    if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
        throw new Error('Unauthorized');
    }

    try {
        let accessKey = config.accessKey;
        let secretKey = config.secretKey;

        if (!accessKey || !secretKey) {
            // Fetch existing encrypted keys and decrypt them
            const { rows } = await query('SELECT access_key_encrypted, secret_key_encrypted FROM s3_buckets WHERE id = $1', [config.id]);
            if (rows.length === 0) throw new Error("Bucket not found");

            // We'll need to import decryptSecret here
            const { decryptSecret } = await import("@/lib/helpers/jose");

            if (!accessKey) accessKey = await decryptSecret(rows[0].access_key_encrypted) || "";
            if (!secretKey) secretKey = await decryptSecret(rows[0].secret_key_encrypted) || "";
        }

        const { S3Client } = await import("@aws-sdk/client-s3");

        const client = new S3Client({
            region: config.region || 'auto',
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            forcePathStyle: true,
        });

        await client.send(new HeadBucketCommand({ Bucket: config.name }));
        return { success: true, message: "Connection successful" };

    } catch (error: any) {
        // console.error("Verify failed:", error);
        return { success: false, message: error.message || "Connection failed" };
    }
}
