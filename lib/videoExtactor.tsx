import * as cheerio from 'cheerio';

export interface VideoData {
  url: string;
  type: "mp4" | "hls" | "dash" | "webm" | "ogg" | "unknown";
  previewUrl?: string;
}

export async function extractVideoFromPage(pageUrl: string, proxyUrl?: string): Promise<VideoData[]> {
  try {
    const fetchUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(pageUrl)}` : pageUrl;
    const response = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    console.log(response)
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const videos: VideoData[] = [];

    // Detect video format
    const detectVideoType = (url: string): VideoData["type"] => {
      if (url.includes(".m3u8")) return "hls";
      if (url.includes(".mpd")) return "dash";
      if (url.includes(".mp4")) return "mp4";
      if (url.includes(".webm")) return "webm";
      if (url.includes(".ogv") || url.includes(".ogg")) return "ogg";
      return "unknown";
    };

    // Extract videos
    $("video source, video").each((_, el) => {
      const url = $(el).attr("src");
      if (url) videos.push({ url, type: detectVideoType(url), previewUrl: $("video").attr("poster") || undefined });
    });

    // Extract Open Graph videos
    const ogVideo = $('meta[property="og:video"]').attr("content");
    if (ogVideo) {
      videos.push({ url: ogVideo, type: detectVideoType(ogVideo), previewUrl: $('meta[property="og:image"]').attr("content") });
    }

    return videos;
  } catch (error) {
    console.error("Error extracting videos:", error);
    return [];
  }
}
