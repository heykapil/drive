// app/api/zip-files/route.ts
import { NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';
export async function POST(request: Request) {
  try {
    const { presignedUrls } = await request.json();

    if (!presignedUrls?.length) {
      return new NextResponse('No files provided', { status: 400 });
    }

    // Create a new archiver instance
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level
    });

    // Set up the response stream
    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (data) => controller.enqueue(data));
        archive.on('end', () => controller.close());
        archive.on('error', (err) => controller.error(err));
      }
    });

    // Set response headers for zip download
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="download.zip"'
    });

    // Process files in parallel
    await Promise.all(
      presignedUrls.map(async (url: string, index: number) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${url}`);

          // Get filename from URL or use a default
          const filename = new URL(url).pathname.split('/').pop() || `file-${index + 1}`;

          // Convert Web ReadableStream to Node.js Readable
          const nodeStream = Readable.fromWeb(response.body as any);
          archive.append(nodeStream, { name: filename });
        } catch (error) {
          console.error(`Error processing file ${url}:`, error);
          archive.abort();
        }
      })
    );

    // Finalize the archive
    archive.finalize();

    return new Response(stream, { headers });

  } catch (error) {
    console.error('Zipping error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
