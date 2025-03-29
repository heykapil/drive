'use client';

import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import {
    ChevronsLeft,
    ChevronsRight,
    Expand,
    Pause,
    PictureInPicture,
    Play,
    Shrink,
    Volume2,
    VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Media {
  url: string;
  id:  string;
}

let activeVideoId: string | null = null;

export const VideoPlayer: React.FC<Media> = ({ url, id }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPiP, setIsPiP] = useState(false);

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
    const handlePiPChange = () => setIsPiP(document.pictureInPictureElement === video);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('enterpictureinpicture', handlePiPChange);
    video.addEventListener('leavepictureinpicture', handlePiPChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('enterpictureinpicture', handlePiPChange);
      video.removeEventListener('leavepictureinpicture', handlePiPChange);
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

  const handlePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    const video = videoRef.current;
    const progressBar = progressRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
    setCurrentTime(video.currentTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div id={id} className="relative h-full w-full bg-black" onMouseMove={resetControlsTimeout}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover rounded-lg"
        onClick={togglePlayPause}
        muted={isMuted}
      />
      {/* Controls */}
      <div className={cn(
        "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex items-center justify-between px-2 py-2">
          <button onClick={togglePlayPause} className="text-white">
            {isPlaying ? <Pause className='rounded-full' size={18} /> : <Play size={18} />}
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => (videoRef.current!.currentTime -= 10)} className="text-white">
              <ChevronsLeft size={18} />
            </button>
            <button onClick={() => (videoRef.current!.currentTime += 10)} className="text-white">
              <ChevronsRight size={18} />
            </button>
            <button onClick={handleMuteToggle} className="text-white">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={handlePiP} className="text-white">
              <PictureInPicture size={18} />
            </button>
            <button onClick={handleFullScreen} className="text-white">
              {isFullScreen ? <Shrink size={18} /> : <Expand size={18} />}
            </button>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-1 px-2">
          {/* Current Time */}
          <span className="text-xs text-white">{formatTime(currentTime)}</span>

          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="h-1 flex-1 bg-neutral-500 rounded-lg cursor-pointer relative"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-gray-300 rounded"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          {/* Duration */}
          <span className="text-xs text-white">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
