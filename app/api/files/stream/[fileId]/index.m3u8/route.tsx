
import { getStreamLink } from '@/lib/actions/terabox';
import { query } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        const { fileId } = await params;

        if (!fileId) {
            return new NextResponse('File ID is required', { status: 400 });
        }

        const { rows } = await query(
            'SELECT key, bucket_id, tb_bucket_id FROM files WHERE id = $1',
            [fileId]
        );

        if (rows.length === 0) {
            return new NextResponse('File not found', { status: 404 });
        }

        const { key, tb_bucket_id } = rows[0];

        // Only support Terabox files for now via this route
        if (!tb_bucket_id) {
            return new NextResponse('Not a Terabox file', { status: 400 });
        }

        const m3u8Content = await getStreamLink(tb_bucket_id, key);

        if (!m3u8Content) {
            return new NextResponse('Failed to retrieve stream', { status: 500 });
        }

        return new NextResponse(m3u8Content, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Content-Disposition': 'inline; filename="video.m3u8"',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
        });

    } catch (error) {
        console.error('Error fetching stream:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
