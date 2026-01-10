'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import {
  Download,
  Expand,
  Pause,
  PictureInPicture,
  Play,
  Settings,
  Shrink,
  Volume2,
  VolumeX
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Media {
  url: string;
  id: string;
  poster?: string;
}

let activeVideoId: string | null = null;

export const VideoPlayer: React.FC<Media> = ({ url, id, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityLevels, setQualityLevels] = useState<number[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPiP, setIsPiP] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  // Utility: pick slider color by volume
  const getVolumeColor = (vol: number) => {
    if (vol > 0.66) return 'bg-green-500';
    if (vol > 0.33) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Initialize HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initHls = async () => {
      if (Hls.isSupported() && url.endsWith('.m3u8')) {
        hlsRef.current?.destroy();

        // Fetch auth token for authenticated streaming
        // const session = await getUploadToken();

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => {
            // Add authorization header to all HLS requests (manifest + segments)
            xhr.withCredentials = true;
          },
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setQualityLevels(hls.levels.map((_, idx) => idx));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setSelectedQuality(data.level);
        });
      } else {
        video.src = url;
      }
    };

    initHls();

    return () => { hlsRef.current?.destroy(); };
  }, [url]);

  // Sync video settings & events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSettings = () => {
      video.volume = volume;
      video.muted = isMuted;
      video.playbackRate = playbackRate;
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMeta = () => setDuration(video.duration);
    const onPiPChange = () => setIsPiP(document.pictureInPictureElement === video);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);

    updateSettings();
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('enterpictureinpicture', onPiPChange);
    video.addEventListener('leavepictureinpicture', onPiPChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('enterpictureinpicture', onPiPChange);
      video.removeEventListener('leavepictureinpicture', onPiPChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [volume, isMuted, playbackRate]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the video container is focused or if we are in fullscreen
      // Or simply if the user is interacting with the video (mouse over) - but global might be annoying.
      // Let's restrict to when the container has focus or mouse is over it?
      // For now, let's just check if activeVideoId matches this id to avoid conflicts
      if (activeVideoId !== id) return;

      // Don't interfere with inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'arrowright':
          e.preventDefault();
          skip(5);
          break;
        case 'arrowleft':
          e.preventDefault();
          skip(-5);
          break;
        case 'f':
          e.preventDefault();
          handleFullScreen();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id]); // Dependencies will be handled by refs/state updates

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  // Play/Pause toggle and ensure single active video
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (activeVideoId && activeVideoId !== id) {
      // Pause other video if playing
      const otherVideo = document.getElementById(activeVideoId)?.querySelector('video');
      if (otherVideo) otherVideo.pause();
    }
    activeVideoId = id;

    if (video.paused) {
      video.play().catch(() => { }); // Catch potential play errors
    } else {
      video.pause();
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const newVol = values[0] / 100;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSpeedChange = (val: string) => {
    const speed = parseFloat(val);
    setPlaybackRate(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  const handleQualityChange = (val: string) => {
    const lvl = parseInt(val, 10);
    setSelectedQuality(lvl);
    if (hlsRef.current) hlsRef.current.currentLevel = lvl;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFullScreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => console.error(err));
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const handlePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error("PiP failed:", error);
    }
  };

  const resetControls = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
    setCurrentTime(video.currentTime);
  };

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pct * 100);
    setHoverTime(pct * duration);
  };

  const handleProgressMouseLeave = () => {
    setHoverPosition(null);
    setHoverTime(null);
  };

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "00:00";
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className="relative w-full h-full aspect-video bg-black group overflow-hidden rounded-lg shadow-xl ring-1 ring-white/10"
      onMouseMove={resetControls}
      onMouseEnter={() => { activeVideoId = id; setShowControls(true); }}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => {
        // Focus the container for keyboard events if we add tabindex
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        onDoubleClick={handleFullScreen}
        muted={isMuted}
        poster={poster}
        playsInline
      />

      {/* Big Play Button (Center) */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 backdrop-blur-sm p-4 rounded-full text-white animate-in fade-in zoom-in duration-300">
            <Play size={48} fill="currentColor" />
          </div>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-all duration-500 ease-out pt-12 pb-2 px-4',
        showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}>

        {/* Progress Bar */}
        <div
          className="relative w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all duration-200 mb-4 group/progress"
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
        >
          {/* Buffered/Loaded (Optional - could add if we access buffered ranges) */}

          {/* Current Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover/progress:scale-100 transition-transform" />
          </div>

          {/* Hover Tooltip */}
          {hoverPosition !== null && hoverTime !== null && (
            <div
              className="absolute bottom-full mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded border border-white/10 -translate-x-1/2 pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={togglePlayPause} className="text-white hover:text-primary transition-colors">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            <div className="flex items-center gap-2 group/volume">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-white hover:text-primary transition-colors" onClick={handleMuteToggle}>
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-8 p-2 bg-black/90 border-white/10 backdrop-blur-xl h-32 flex flex-col items-center justify-center">
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    orientation="vertical"
                    className="h-24 w-2"
                  >
                  </Slider>
                </PopoverContent>
              </Popover>
            </div>

            <span className="text-xs font-medium text-white/90 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-white/80 hover:text-white hover:rotate-45 transition-all duration-300">
                  <Settings size={20} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" className="w-64 p-4 bg-black/90 text-white border-white/10 backdrop-blur-xl rounded-xl shadow-2xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Playback Speed</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[0.5, 1, 1.5, 2].map(s => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s.toString())}
                          className={cn(
                            "text-xs py-1.5 rounded-md transition-colors border border-transparent",
                            playbackRate === s ? "bg-white text-black font-bold" : "bg-white/5 hover:bg-white/10 hover:border-white/20"
                          )}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {qualityLevels.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Quality</label>
                      <Select value={selectedQuality.toString()} onValueChange={handleQualityChange}>
                        <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-8 text-xs">
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-white/10 text-white">
                          <SelectItem value="-1">Auto</SelectItem>
                          {qualityLevels.map(l => (
                            <SelectItem key={l} value={l.toString()}>
                              {hlsRef.current?.levels[l]?.height}p
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    size="sm"
                    className="w-full bg-white/5 border-white/10 text-white hover:bg-white hover:text-black transition-colors h-8 text-xs"
                  >
                    <Download className="mr-2 h-3 w-3" /> Download Video
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <button onClick={handlePiP} className="text-white/80 hover:text-white transition-colors p-1.5">
              <PictureInPicture size={20} />
            </button>

            <button onClick={handleFullScreen} className="text-white/80 hover:text-white transition-colors p-1.5">
              {isFullScreen ? <Shrink size={20} /> : <Expand size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
