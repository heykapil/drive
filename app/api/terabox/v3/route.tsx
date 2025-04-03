import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

//
// Type Definitions
//

type SessionResult = {
  isLogin: boolean;
  pos?: any;
  cookie: string;
  user_id: string;
};

export type FileItem = {
  is_dir: boolean;
  path: string;
  fs_id: string;
  name: string;
  type: string;
  size: number | string;
  image: string;
  link: string;
  list: FileItem[];
};

export type FileResult = {
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

export type LinkResult = {
  status: string;
  download_link: {
    url_1: string;
    url_2?: string;
    url_3?: string;
  };
};

//
// TeraboxSession: Checks credentials and logs in using a local config file
//
class TeraboxSession {
  cookie = '';
  user_id = '';
  isLogin = false;
  pos: any = null;
  params: Record<string, string> = {
    app_id: '250528',
    web: '1',
    channel: 'dubox',
    clienttype: '5',
    'dp-logid': '',
    client: 'web',
    pass_version: '2.8',
    lang: 'id',
    need_relation: '0',
    need_secret_info: '1',
    clientfrom: 'h5',
  };

  async generateCookie(): Promise<void> {
    // Read config file from backend/json/config.json relative to project root
    try {
      const filePath = path.join(process.cwd(), 'backend', 'json', 'config.json');
      const dataStr = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(dataStr);
      this.cookie = data.cookie || process.env.TERABOX_COOKIE;
      this.user_id = data.user_id || '';
    } catch {
    this.cookie = process.env.TERABOX_COOKIE || '';
      this.user_id = '';
    }
  }

  async generateAuth(): Promise<void> {
    try {
      const authRes = await fetch('https://dm.terabox.com/indonesian/main?category=all', {
        headers: { ...HEADERS, Cookie: this.cookie },
        redirect: 'follow',
      });
      let text = await authRes.text();
      text = text.replace(/\\/g, '');
      const jsTokenMatch = text.match(/%28%22(.*?)%22%29/);
      const pcftokenMatch = text.match(/"pcftoken":"(.*?)"/);
      const bdstokenMatch = text.match(/"bdstoken":"(.*?)"/);
      if (jsTokenMatch && pcftokenMatch && bdstokenMatch) {
        this.params.jsToken = jsTokenMatch[1];
        this.params.pcftoken = pcftokenMatch[1];
        this.params.user_list = `["${this.user_id}"]`;
        this.params.bdstoken = bdstokenMatch[1];

        const qs = new URLSearchParams(this.params).toString();
        const url = `https://dm.terabox.com/api/user/getinfo?${qs}`;
        const infoRes = await fetch(url, { headers: { ...HEADERS, Cookie: this.cookie } });
        this.pos = await infoRes.json();
        this.isLogin = Array.isArray(this.pos.records) && this.pos.records.length > 0;
      } else {
        this.isLogin = false;
      }
    } catch {
      this.isLogin = false;
    }
  }
}

//
// TeraboxFile: Gets file/folder listing and details using Terabox’s API endpoints
//
class TeraboxFile {
  cookie: string;
  headers: Record<string, string> = HEADERS;
  folder_params: Record<string, string> = {
    app_id: '250528',
    'dp-logid': '',
    web: '1',
    channel: 'dubox',
    clienttype: '0',
    root: '1',
    scene: '',
  };
  file_params: Record<string, string> = {
    app_id: '250528',
    'dp-logid': '',
    web: '1',
    channel: 'dubox',
    clienttype: '0',
    page: '1',
    num: '1000',
    by: 'name',
    order: 'asc',
    site_referer: '',
  };
  result: FileResult = {
    status: 'failed',
    js_token: '',
    browser_id: '',
    cookie: '',
    sign: '',
    timestamp: '',
    shareid: '',
    uk: '',
    list: [],
  };
  short_url = '';

  constructor(cookie: string = '') {
    this.cookie = cookie;
  }

  async search(url: string): Promise<void> {
    const res = await fetch(url, { redirect: 'follow' });
    const finalUrl = res.url;
    const m = finalUrl.match(/surl=([^ &]+)/);
    if (!m) throw new Error('Could not extract short URL');
    this.short_url = m[1];
    await this.getAuthorization();
    await this.getMainFile();
  }

  async getAuthorization(): Promise<void> {
    const url = `https://www.terabox.app/wap/share/filelist?surl=${this.short_url}`;
    const res = await fetch(url, {
      headers: { ...this.headers, Cookie: this.cookie },
      redirect: 'follow',
    });
    const text = await res.text();
    const cleaned = text.replace(/\\/g, '');
    const jsTokenMatch = cleaned.match(/%28%22(.*?)%22%29/);
    if (!jsTokenMatch) throw new Error('js_token not found');
    const js_token = jsTokenMatch[1];
    const setCookie = res.headers.get('set-cookie') || '';
    const browserMatch = setCookie.match(/browserid=([^;]+)/);
    const browser_id = browserMatch ? browserMatch[1] : '';
    this.result.js_token = js_token;
    this.result.browser_id = browser_id;
    this.result.cookie = this.cookie;
  }

  async getMainFile(): Promise<void> {
    const params = { jsToken: this.result.js_token, shorturl: '1' + this.short_url, ...this.folder_params };
    const qs = new URLSearchParams(params).toString();
    const url = `https://dm.terabox.app/api/shorturlinfo?${qs}`;
    const res = await fetch(url, {
      headers: { ...this.headers, Cookie: this.cookie },
    });
    const data = await res.json();
    const root_dir = data.list;
    if (root_dir) {
      this.result.sign = data.sign;
      this.result.timestamp = data.timestamp;
      this.result.shareid = data.shareid;
      this.result.uk = data.uk;

      const params2 = {
        ...this.folder_params,
        jsToken: this.result.js_token,
        shorturl: this.short_url,
        dir: '/',
        page: '1',
        num: '1000',
        by: 'name',
        order: 'asc',
        site_referer: '',
        root: '1',
      };
      const qs2 = new URLSearchParams(params2).toString();
      const url_root = `https://dm.terabox.app/share/list?${qs2}`;
      const rootRes = await fetch(url_root, {
        headers: { ...this.headers, Cookie: this.cookie },
      });
      const rootData = await rootRes.json();
      const all_file = await this.packData(rootData);
      if (all_file.length > 0) {
        this.result.list = all_file;
        this.result.status = 'success';
      }
    }
  }

  async getChildFile(pathStr: string): Promise<FileItem[]> {
    const params = { jsToken: this.result.js_token, shorturl: this.short_url, dir: pathStr, ...this.file_params };
    const qs = new URLSearchParams(params).toString();
    const url = `https://dm.terabox.app/share/list?${qs}`;
    const res = await fetch(url, {
      headers: { ...this.headers, Cookie: this.cookie },
    });
    const data = await res.json();
    return this.packData(data);
  }

  async packData(req: any): Promise<FileItem[]> {
    const list = req.list || [];
    const result: FileItem[] = await Promise.all(
      list.map(async (item: any) => {
        const is_dir = Boolean(Number(item.isdir));
        return {
          is_dir,
          path: item.path,
          fs_id: item.fs_id,
          name: item.server_filename,
          type: is_dir ? 'other' : this.checkFileType(item.server_filename),
          size: is_dir ? 0 : item.size,
          image: is_dir ? '' : (item.thumbs?.url3 || ''),
          link: is_dir ? '' : item.dlink || '',
          list: is_dir ? await this.getChildFile(item.path) : [],
        };
      })
    );
    return result;
  }

  checkFileType(name: string): string {
    name = name.toLowerCase();
    if (/\.(mp4|mov|mkv|m4v|asf|avi|wmv|m2ts|3g2)/.test(name)) {
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

//
// TeraboxLink: Generates fast download links based on a given URL
//
class TeraboxLink {
  result: LinkResult = { status: 'failed', download_link: { url_1: '' } };

  constructor(url: string) {
    this.result.download_link.url_1 = url;
  }

  async generate(url: string): Promise<void> {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      const old_url = res.url;
      const domainMatch = old_url.match(/:\/\/(.*?)\./);
      const old_domain = domainMatch ? domainMatch[1] : '';
      const medium_url = old_url.replace('by=themis', 'by=dapunta');
      const fast_url = old_url.replace(old_domain, 'd3').replace('by=themis', 'by=dapunta');
      this.result.download_link.url_2 = medium_url;
      this.result.download_link.url_3 = fast_url;
    } catch {
    }
  }
}

//
// Next.js API Route Handler
//
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  if (mode === 'session') {
    // Use mode=session to check credentials
    const session = new TeraboxSession();
    await session.generateCookie();
    await session.generateAuth();
    const result: SessionResult = {
      isLogin: session.isLogin,
      pos: session.pos,
      cookie: session.cookie,
      user_id: session.user_id,
    };
    return NextResponse.json(result);
  } else if (mode === 'file') {
    // Use mode=file to get file/folder listing.
    const url = searchParams.get('url');
    const cookie = searchParams.get('cookie') || '';
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter.' }, { status: 400 });
    }
    const file = new TeraboxFile(cookie);
    await file.search(url);
    return NextResponse.json(file.result);
  } else if (mode === 'link') {
    // Use mode=link to generate fast download links.
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter for link generation.' }, { status: 400 });
    }
    const link = new TeraboxLink(url);
    await link.generate(url);
    link.result.status = 'success';
    return NextResponse.json(link.result);
  } else {
    return NextResponse.json(
      { error: 'Invalid mode. Use mode=session, mode=file, or mode=link.' },
      { status: 400 }
    );
  }
}
