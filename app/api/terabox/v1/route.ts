import { NextRequest, NextResponse } from 'next/server';

interface TeraBoxFile {
  fs_id: string;
  is_dir: string | number;
  category?: string | number;
  filename: string;
  size: string | number;
  children?: TeraBoxFile[];
  downloadUrl?: string;
  watchUrl?: string;
  [key: string]: any;
}

interface TeraBoxInfoResponse {
  status?: string;
  message?: string;
  shareid: string;
  uk: string;
  sign: string;
  timestamp: string;
  list: TeraBoxFile[];
}

interface DownloadResponse {
  downloadLink?: string;
  [key: string]: any;
}

interface WatchResponse {
  directLink?: string;
  [key: string]: any;
}

export interface ProcessedResult {
  items: TeraBoxFile[];
  downloadUrls: string[];
  watchUrls: string[];
  filenames: string[];
  sizes: number[];
}



const API_BASE = 'https://terabox.hnn.workers.dev/api';
const GET_INFO_URL = `${API_BASE}/get-info`;
const GET_DOWNLOAD_URL = `${API_BASE}/get-download`;
const GET_WATCH_URL = `${API_BASE}/get-downloadp`;

function isDirectory(file: TeraBoxFile): boolean {
  return String(file.is_dir) === '1';
}

async function fetchFileUrls(
  fsId: string,
  params: { shareid: string; uk: string; sign: string; timestamp: string }
): Promise<{ downloadUrl?: string; watchUrl?: string }> {
  try {
    const [downloadRes, watchRes] = await Promise.all([
      fetch(GET_DOWNLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, fs_id: fsId }),
      }),
      fetch(GET_WATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, fs_id: fsId }),
      }),
    ]);

    const [downloadData, watchData] = await Promise.all([
      downloadRes.json() as Promise<DownloadResponse>,
      watchRes.json() as Promise<WatchResponse>,
    ]);

    return {
      downloadUrl: downloadData.downloadLink,
      watchUrl: watchData.downloadLink,
    };
  } catch (error) {
    console.error(`Failed to fetch URLs for ${fsId}:`, error);
    return {};
  }
}

// Modified processItems function to collect URLs
async function processItems(
  items: TeraBoxFile[],
  params: { shareid: string; uk: string; sign: string; timestamp: string }
): Promise<ProcessedResult> {
  const result: ProcessedResult = {
    items: [],
    downloadUrls: [],
    watchUrls: [],
    filenames: [],
    sizes: [],
  };

  for (const item of items) {
    if (isDirectory(item)) {
      // Process directory recursively
      const childrenResult = await processItems(item.children || [], params);
      result.downloadUrls.push(...childrenResult.downloadUrls);
      result.watchUrls.push(...childrenResult.watchUrls);
      result.filenames.push(...childrenResult.filenames);
      result.sizes.push(...childrenResult.sizes);

      result.items.push({
        ...item,
        children: childrenResult.items,
        fs_id: String(item.fs_id),
        is_dir: '1'
      });
    } else {
      // Process file
      const urls = await fetchFileUrls(String(item.fs_id), params);
      const newItem = {
        ...item,
        ...urls,
        fs_id: String(item.fs_id),
        is_dir: '0'
      };

      result.items.push(newItem);

        if (urls.downloadUrl || urls.watchUrl) {
          result.filenames.push(item.filename);
          result.sizes.push(Number(item.size));
        }

         if (urls.downloadUrl) result.downloadUrls.push(urls.downloadUrl);
         if (urls.watchUrl) result.watchUrls.push(urls.watchUrl);
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { shorturl, pwd } = await request.json();

    if (!shorturl) {
      return NextResponse.json(
        { status: 'error', message: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch initial information
    const infoUrl = new URL(GET_INFO_URL);
    infoUrl.searchParams.set('shorturl', shorturl);
    if (pwd) infoUrl.searchParams.set('pwd', pwd);

    const infoResponse = await fetch(infoUrl.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!infoResponse.ok) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch file info' },
        { status: infoResponse.status }
      );
    }

    const infoData: TeraBoxInfoResponse = await infoResponse.json();

    if (infoData.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: infoData.message },
        { status: 400 }
      );
    }

    // Validate required parameters
    const { shareid, uk, sign, timestamp, list } = infoData;
    if (!shareid || !uk || !sign || !timestamp || !list) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid API response' },
        { status: 500 }
      );
    }

    const processedResult = await processItems(list, { shareid, uk, sign, timestamp });

        // Filter out empty directories
        const filterItems = (items: TeraBoxFile[]): TeraBoxFile[] => {
          return items
            .map(item => {
              if (isDirectory(item)) {
                const filteredChildren = filterItems(item.children || []);
                return filteredChildren.length > 0
                  ? { ...item, children: filteredChildren }
                  : null;
              }
              return (item.downloadUrl || item.watchUrl) ? item : null;
            })
            .filter((item): item is TeraBoxFile => item !== null);
        };

        const filteredList = filterItems(processedResult.items);

        return NextResponse.json({
          ...infoData,
          list: filteredList,
          downloadUrls: processedResult.downloadUrls,
          watchUrls: processedResult.watchUrls,
          filenames: processedResult.filenames,
          sizes: processedResult.sizes,
        });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
