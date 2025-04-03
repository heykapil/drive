import { NextResponse } from 'next/server';

const HEADERS: Record<string, string> = {
  'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
};

// ---------- Type Definitions ----------

export type FileItem = {
  is_dir: boolean;
  path: string;
  fs_id: string;
  name: string;
  type: string;
  size: string | number;
  image: string;
  list: FileItem[];
};

export type TeraboxFileResult = {
  status: string;
  js_token: string;
  browser_id: string;
  cookie: string;
  sign: string;
  timestamp: string;
  shareid: string;
  uk: string;
  list: FileItem[];
};

export type TeraboxLinkResult = {
  status: string;
  download_link: {
    url_1?: string;
    url_2?: string;
    url_3?: string;
  };
};

// ---------- TeraboxFile Class ----------

class TeraboxFile {
  shortUrl: string = '';
  result: TeraboxFileResult = {
    status: 'failed',
    js_token: '',
    browser_id: '',
    cookie: '',
    sign: '',
    timestamp: '',
    shareid: '',
    uk: '',
    list: []
  };

  // Main control method: get short URL, then get authorization and main file list
  async search(url: string): Promise<void> {
    // follow redirects and get the final URL
    const res = await fetch(url, { redirect: 'follow' });
    // extract surl from final URL (regex: surl=([^ &]+))
    const m = res.url.match(/surl=([^ &]+)/);
    if (!m) throw new Error('Could not extract short URL');
    this.shortUrl = m[1];

    await this.getAuthorization();
    await this.getMainFile();
  }

  // Get js_token and browserid from authorization endpoint
  async getAuthorization(): Promise<void> {
    const url = `https://www.terabox.app/wap/share/filelist?surl=${this.shortUrl}`;
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    const text = await res.text();
    // Remove backslashes and use regex to extract token
    const cleaned = text.replace(/\\/g, '');
    const tokenMatch = cleaned.match(/%28%22(.*?)%22%29/);
    if (!tokenMatch) throw new Error('js_token not found');
    const js_token = tokenMatch[1];

    // Extract browserid from the set-cookie header (simplified)
    const setCookie = res.headers.get('set-cookie') || '';
    const browserMatch = setCookie.match(/browserid=([^;]+)/);
    const browser_id = browserMatch ? browserMatch[1] : '';

    // Combine cookies. Here we prepend with a fixed lang value.
    const cookie = 'lang=id;' + setCookie.split(',').map(c => c.trim()).join(';');

    this.result.js_token = js_token;
    this.result.browser_id = browser_id;
    this.result.cookie = cookie;
  }

  // Get the main file (root layer) info and pack the file data.
  async getMainFile(): Promise<void> {
    const url = `https://www.terabox.com/api/shorturlinfo?app_id=250528&shorturl=1${this.shortUrl}&root=1`;
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();

    // pack file list data
    const allFile = await this.packData(data, this.shortUrl);
    if (allFile.length > 0) {
      this.result.sign = data.sign;
      this.result.timestamp = data.timestamp;
      this.result.shareid = data.shareid;
      this.result.uk = data.uk;
      this.result.list = allFile;
      this.result.status = 'success';
    }
  }

  // Recursively get child file data for directories
  async getChildFile(shortUrl: string, path: string = '', root: string = '0'): Promise<FileItem[]> {
    const params = new URLSearchParams({
      app_id: '250528',
      shorturl: shortUrl,
      root,
      dir: path
    });
    const url = 'https://www.terabox.com/share/list?' + params.toString();
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();
    return this.packData(data, shortUrl);
  }

  // Pack each file's information into our FileItem type
  async packData(req: any, shortUrl: string): Promise<FileItem[]> {
    const list: FileItem[] = await Promise.all(
      (req.list || []).map(async (item: any): Promise<FileItem> => {
        const isDir = Boolean(parseInt(item.isdir));
        return {
          is_dir: isDir,
          path: item.path,
          fs_id: item.fs_id,
          name: item.server_filename,
          type: isDir ? 'other' : this.checkFileType(item.server_filename),
          size: isDir ? '' : item.size,
          image: isDir ? '' : (item.thumbs?.url3 || ''),
          list: isDir ? await this.getChildFile(shortUrl, item.path, '0') : []
        };
      })
    );
    return list;
  }

  // Determine file type based on file extension
  checkFileType(name: string): string {
    name = name.toLowerCase();
    if (/\.(mp4|mov|m4v|mkv|asf|avi|wmv|m2ts|3g2)/.test(name)) {
      return 'video';
    } else if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(name)) {
      return 'image';
    } else if (/\.(pdf|docx|zip|rar|7z)/.test(name)) {
      return 'file';
    } else {
      return 'other';
    }
  }
}

// ---------- TeraboxLink Class ----------

class TeraboxLink {
  dynamicParams: Record<string, string>;
  staticParam: Record<string, string> = {
    app_id: '250528',
    channel: 'dubox',
    product: 'share',
    clienttype: '0',
    'dp-logid': '',
    nozip: '0',
    web: '1'
  };

  result: TeraboxLinkResult = {
    status: 'failed',
    download_link: {}
  };

  cookie: string;

  constructor(
    fs_id: string,
    uk: string,
    shareid: string,
    timestamp: string,
    sign: string,
    jsToken: string,
    cookie: string
  ) {
    this.cookie = cookie;
    this.dynamicParams = {
      uk,
      sign,
      shareid,
      primaryid: shareid,
      timestamp,
      jsToken,
      fid_list: `[${fs_id}]`
    };
  }

  // Generate main download link
  async generate(): Promise<void> {
    const params = new URLSearchParams({
      ...this.dynamicParams,
      ...this.staticParam
    });
    const url = 'https://www.terabox.com/share/download?' + params.toString();
    const res = await fetch(url, {
      headers: { ...HEADERS, Cookie: this.cookie, 'Referer': 'https://www.terabox.com/' }
    });
    const data = await res.json();
    console.log(url)
    if (!data.errno) {
      const slow_url = data.dlink;
      this.result.download_link.url_1 = slow_url;
      this.result.status = 'success';
      await this.generateFastURL();
    } else {
      this.result.status = `url: ${JSON.stringify(url)}`;
    }
  }

  // Generate fast download links based on redirection
  async generateFastURL(): Promise<void> {
    try {
      // Using HEAD request to follow redirects and get the final URL.
      const res = await fetch(this.result.download_link.url_1!, {
        method: 'HEAD',
        redirect: 'follow'
      });
      const old_url = res.url;
      const domainMatch = old_url.match(/:\/\/(.*?)\./);
      const old_domain = domainMatch ? domainMatch[1] : '';
      const medium_url = old_url.replace('by=themis', 'by=dapunta');
      const fast_url = old_url.replace(old_domain, 'd3').replace('by=themis', 'by=dapunta');
      this.result.download_link.url_2 = medium_url;
      this.result.download_link.url_3 = fast_url;
    } catch (error: any) {
      this.result.status =  `error + ${error.message}`;
    }
  }
}

// ---------- Next.js API Route Handler ----------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  if (mode === 'file') {
    // Expect a "url" query parameter for file listing
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'Missing "url" query parameter.' }, { status: 400 });
    }
    try {
      const teraboxFile = new TeraboxFile();
      await teraboxFile.search(url);
      return NextResponse.json(teraboxFile.result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Error processing file request' }, { status: 500 });
    }
  } else if (mode === 'link') {
    // Expect parameters: fs_id, uk, shareid, timestamp, sign, jsToken, cookie
    const fs_id = searchParams.get('fs_id');
    const uk = searchParams.get('uk');
    const shareid = searchParams.get('shareid');
    const timestamp = searchParams.get('timestamp');
    const sign = searchParams.get('sign');
    const jsToken = searchParams.get('jsToken');
    const cookie = searchParams.get('cookie');

    if (!fs_id || !uk || !shareid || !timestamp || !sign || !jsToken || !cookie) {
      return NextResponse.json({ error: 'Missing one or more required parameters for link generation.' }, { status: 400 });
    }

    try {
      const teraboxLink = new TeraboxLink(fs_id, uk, shareid, timestamp, sign, jsToken, cookie);
      await teraboxLink.generate();
      return NextResponse.json(teraboxLink.result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Error processing link request' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid mode. Use mode=file or mode=link.' }, { status: 400 });
  }
}
