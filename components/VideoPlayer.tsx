"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

const VideoPlayer = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!url || !videoRef.current) return;

    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari supports HLS natively
      video.src = url;
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);

      return () => hls.destroy(); // Cleanup when unmounting
    }
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-full object-cover"
      playsInline
    />
  );
};

export default VideoPlayer;
