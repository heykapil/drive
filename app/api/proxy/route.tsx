// app/api/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

// List of rotating User-Agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

export async function GET(request: NextRequest) {
  try {
    const fileUrl = request.nextUrl.searchParams.get('url');
    if (!fileUrl) return new Response('URL parameter missing', { status: 400 });

    const proxyResponse = await fetch(fileUrl, {
      headers: {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.terabox.com/',
        'Origin': 'https://www.terabox.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-site'
      },
      redirect: 'follow'
    });

    if (!proxyResponse.ok) {
      return new Response(`Upstream error: ${proxyResponse.statusText}`, {
        status: proxyResponse.status
      });
    }

    // Forward the response with proper streaming
    const { readable, writable } = new TransformStream();
    proxyResponse.body?.pipeTo(writable);

    return new Response(readable, {
      headers: {
        'Content-Type': proxyResponse.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
