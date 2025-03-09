'use client';

import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import { ChevronsLeft, ChevronsRight, Expand, Pause, Play, Shrink, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Media {
  url: string;
  id: string;
}

let activeVideoId: string | null = null;

export const VideoPlayer: React.FC<Media> = ({ url, id }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported() && url.endsWith('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
    }
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (activeVideoId && activeVideoId !== id) {
      document.getElementById(activeVideoId)?.querySelector('video')?.pause();
    }
    activeVideoId = id;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleFullScreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!document.fullscreenElement) {
      video.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  return (
    <div id={id} className="relative h-full w-full bg-black" onMouseMove={resetControlsTimeout}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        onClick={togglePlayPause}
        muted={isMuted}
      />
      {/* Controls */}
      <div className={cn(
        "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-opacity",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={togglePlayPause} className="text-white">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => (videoRef.current!.currentTime -= 10)} className="text-white">
              <ChevronsLeft size={18} />
            </button>
            <button onClick={() => (videoRef.current!.currentTime += 10)} className="text-white">
              <ChevronsRight size={18} />
            </button>
            <button onClick={handleMuteToggle} className="text-white">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={handleFullScreen} className="text-white">
              {isFullScreen ? <Shrink size={18} /> : <Expand size={18} />}
            </button>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="h-1 bg-gray-600">
          <div className="h-full bg-gray-300" style={{ width: `${(currentTime / duration) * 100}%` }} />
        </div>
      </div>
    </div>
  );
};
