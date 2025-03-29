import { toast } from "sonner";

export function extractShortUrl(url: string) {
  try {
    const urlObj = new URL(url);
    // Split the pathname and get the segment after "/s"
    const segments = urlObj.pathname.split('/');
    // segments[0] is empty (because the pathname starts with a slash),
    // segments[1] should be 's', and segments[2] is the short URL
    if (segments[1] === 's' && segments[2]) {
      return segments[2];
    }
    return null;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export const extractTeraboxDownloadUrls = async (url: string) => {
  try {

    const shorturl = extractShortUrl(url);
    const response = await fetch(process.env.NEXT_PUBLIC_APP_URL+'/api/terabox/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, shorturl, pwd: '' }),
    });

    if (!response.ok) throw new Error(`API request failed: ${response.status}`);

    const data = await response.json();
    if (!data?.downloadUrls?.length) throw new Error('No download URLs found');
    return data;
  } catch (error: any) {
    toast.error(`Terabox extraction failed: ${error.message}`);
    throw new Error(`Terabox extraction failed: ${error.message}`);
  }
};
