// app/api/terabox/route.ts
import { NextResponse } from 'next/server';

const MY_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  Connection: 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded',
  Cookie: `csrfToken=iGh-Yo7ewy85F3hdhN_hnLIR; browserid=Gvi3NUpFutA9vp70SDD6w04XiwVm4kh6vsmtv-NvQk0RN3r5GZ-iZoWgBTo=; lang=en; TSID=fsElVQwggVO0iarCtbi4eK2bOXmEHcOB; __bid_n=190b5e1604fdf709a14207; _ga=GA1.1.550002563.1721038366; ndus=Y40khCMteHui8ylqBGkjtMh0Sl_bZ2ldXJVG9Is-; ndut_fmt=068AD0CBEF30F69813ABE5D5D740E7AEC588C234F472677EF77BA3269DDDFDCB; ab_sr=1.0.1_MzNiODFhOGU3MDcxNmJhNWY5MDcxMjIwODVkNmRjNjlhYWY2NmI4ZTQxYWFhMTk4NjFhNDk0YzliNWFjYTlmMTdiOWE4OTExZjU1ODUyNTNlMzA1MTQ1ZjY1MzBhN2Q1MDNkM2VkYmY4Y2Y3NTdiYjU5NmJiMzAwNjgyYTQ4Y2QzZWYwMmI1NDFiMjRmZjhkM2QyZWVjNzdiMzU3ZTQ4Nw==; _ga_06ZNKL8C2E=GS1.1.1721043365.2.1.1721044301.40.0.0`,
  Referer: 'https://www.1024tera.com/sharing/link?surl=n-U0a8HesHa1zGFUD008ww',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-ch-ua':
    '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
};

const findBetween = (string: string, start: string, end: string): string => {
  const startIndex = string.indexOf(start) + start.length;
  const endIndex = string.indexOf(end, startIndex);
  return string.substring(startIndex, endIndex);
};

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    // Initial request
    const response = await fetch(url, {
      headers: MY_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const responseData = await response.text();
    const jsToken = findBetween(responseData, 'fn%28%22', '%22%29');
    const logId = findBetween(responseData, 'dp-logid=', '&');

    if (!jsToken || !logId) {
      return NextResponse.json({ error: 'Tokens not found' }, { status: 400 });
    }
    const requestUrl = response.url;
    const surl = new URL(requestUrl).searchParams.get('surl') || '';

    // Prepare params for share/list request
    const params = new URLSearchParams({
      app_id: '250528',
      web: '1',
      channel: 'dubox',
      clienttype: '0',
      jsToken: jsToken,
      dplogid: logId,
      page: '1',
      num: '20',
      order: 'time',
      desc: '1',
      site_referer: requestUrl,
      shorturl: surl,
      root: '1',
    });

    // Second request to get list
    const listUrl = `https://www.1024tera.com/share/list?${params}`;
    const response2 = await fetch(listUrl, {
      headers: MY_HEADERS,
    });

    if (!response2.ok) {
      throw new Error(`Second request failed with status: ${response2.status}`);
    }

    const responseData2 = await response2.json();
    console.log(responseData2);
    if (!responseData2.list) {
      return NextResponse.json({ error: 'No list found' }, { status: 404 });
    }

    // Handle directory case
    if (responseData2.list[0]?.isdir === '1') {
      const newParams = new URLSearchParams({
        app_id: '250528',
        web: '1',
        channel: 'dubox',
        clienttype: '0',
        jsToken: jsToken,
        dplogid: logId,
        page: '1',
        num: '20',
        order: 'asc',
        by: 'name',
        dir: responseData2.list[0].path,
        site_referer: requestUrl,
        shorturl: surl,
      });

      const response3 = await fetch(
        `https://www.1024tera.com/share/list?${newParams}`,
        {
          headers: MY_HEADERS,
        },
      );

      if (!response3.ok) {
        throw new Error(
          `Third request failed with status: ${response3.status}`,
        );
      }

      const responseData3 = await response3.json();
      return NextResponse.json(responseData3.list || []);
    }

    return NextResponse.json(responseData2.list);
  } catch (error) {
    console.error('Error in terabox API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
