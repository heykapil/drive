'use client'
import React from 'react';

export default function TeraboxPage2() {
  const [session, setSession] = React.useState<any | null>(null);

  const [info, setInfo] = React.useState<any | null>(null);
  const [data, setData] = React.useState<any | null>(null);
  const fileUrl = 'https://terafileshare.com/s/13cu4Oy828XYloSMewBw7WA'; // example URL

  React.useEffect(() => {
    const sessionInfo = async () => {
      try {
        const res = await fetch(
          `/api/terabox/v3?mode=session`
        );
        const json = await res.json();
        setSession(json);
      } catch (error) {
        console.error('Error fetching file info:', error);
      }
    };

    sessionInfo();
  }, [fileUrl]);


  // Fetch file listing once on mount
  React.useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(
          `/api/terabox/v3?mode=file&url=${encodeURIComponent(fileUrl)}&cookie=${session?.cookie || process.env.TERABOX_COOKIE}`
        );
        const json = await res.json();
        setInfo(json);
      } catch (error) {
        console.error('Error fetching file info:', error);
      }
    };

    fetchInfo();
  }, [fileUrl]);

  // Once we have info data, fetch download link
  React.useEffect(() => {
    if (info && info.list && info.list.length > 0) {
      const params = new URLSearchParams({
        mode: 'link',
        url: fileUrl,
        fs_id: info.list[0].fs_id,
        uk: info.uk,
        shareid: info.shareid,
        timestamp: info.timestamp,
        sign: info.sign,
        jsToken: info.js_token,
        cookie: info.cookie || process.env.TERABOX_COOKIE
      });
      const fetchDownloadLink = async () => {
        try {
          const res = await fetch(`/api/terabox/v3?${params.toString()}`);
          const json = await res.json();
          setData(json);
        } catch (error) {
          console.error('Error fetching download link:', error);
        }
      };

      fetchDownloadLink();
      console.log('Link params:', params.toString());
    }
  }, [info]);

  return (
    <div>
      <h1>Session Info</h1>
      <pre>{JSON.stringify(session, null, 2)}</pre>
      <h1>Terabox Info</h1>
      <pre>{JSON.stringify(info, null, 2)}</pre>
      <h1>Download Data</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
