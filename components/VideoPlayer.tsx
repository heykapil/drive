"use client";

import Hls from "hls.js";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const VideoContext = createContext<{
  currentPlaying: string | null;
  setCurrentPlaying: (id: string | null, ref: HTMLVideoElement | null) => void;
  activeVideoRef: HTMLVideoElement | null;
}>({
  currentPlaying: null,
  setCurrentPlaying: () => {},
  activeVideoRef: null,
});

export const VideoPlayer = ({ id, src }: { id: string; src: string }) => {
  const { currentPlaying, setCurrentPlaying, activeVideoRef } = useContext(VideoContext);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Destroy previous HLS instance
    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (src.endsWith(".m3u8") && Hls.isSupported()) {
      // ✅ HLS format (e.g., .m3u8)
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error("❌ Fatal HLS error", data);
        }
      });
    } else {
      // ✅ Native playback (.mp4, .mov, etc.)
      video.src = src;
      video.load();
    }

    return () => {
      hlsRef.current?.destroy();
      video.oncanplay = null;
      video.onerror = null;
    };
  }, [src]);

  useEffect(() => {
    if (currentPlaying !== id) {
      videoRef.current?.pause();
    }
  }, [currentPlaying, id]);

  const handlePlay = () => {
    if (activeVideoRef && activeVideoRef !== videoRef.current) {
      activeVideoRef.pause(); // ✅ Explicitly pause the previous video
    }
    setCurrentPlaying(id, videoRef.current);
  };

  return (
    <video
      ref={videoRef}
      controls
      autoPlay={false}
      playsInline
      className="w-full h-full object-cover"
      onPlay={handlePlay}
    />
  );
};

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentPlaying, setCurrentPlayingState] = useState<string | null>(null);
  const [activeVideoRef, setActiveVideoRef] = useState<HTMLVideoElement | null>(null);

  const setCurrentPlaying = (id: string | null, ref: HTMLVideoElement | null) => {
    setCurrentPlayingState(id);
    setActiveVideoRef(ref);
  };

  return (
    <VideoContext.Provider value={{ currentPlaying, setCurrentPlaying, activeVideoRef }}>
      {children}
    </VideoContext.Provider>
  );
};
