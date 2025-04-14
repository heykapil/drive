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

    if (Hls.isSupported() && url.endsWith('.m3u8')) {
      hlsRef.current?.destroy();
      const hls = new Hls();
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

    updateSettings();
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('enterpictureinpicture', onPiPChange);
    video.addEventListener('leavepictureinpicture', onPiPChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('enterpictureinpicture', onPiPChange);
      video.removeEventListener('leavepictureinpicture', onPiPChange);
    };
  }, [volume, isMuted, playbackRate]);

  // Play/Pause toggle and ensure single active video
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (activeVideoId && activeVideoId !== id) {
      document.getElementById(activeVideoId)?.querySelector('video')?.pause();
    }
    activeVideoId = id;
    if (video.paused)
      { video.play()
      } else {
        video.pause()
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

  const resetControls = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * duration;
    setCurrentTime(video.currentTime);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className="relative w-full h-full aspect-video bg-black group"
      onMouseMove={resetControls}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain rounded-lg"
        onClick={togglePlayPause}
        muted={isMuted}
        poster={poster}
        disablePictureInPicture={false}
      />

      {/* Controls Overlay */}
      <div className={cn(
        'absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300',
        showControls ? 'opacity-100' : 'opacity-0'
      )}>
        <div className="flex items-center justify-between px-2 py-1">
          <button onClick={togglePlayPause} className="text-white hover:scale-110 p-1 hover:bg-white/20 rounded-full transition-transform">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className="flex items-center gap-1">
            {/* Volume Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-white hover:bg-white/10 hover:scale-110 p-1 rounded-full" onClick={handleMuteToggle}>
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </PopoverTrigger>
              <PopoverContent align='start' className="w-24 p-1 bg-background/80 border-muted backdrop-blur-lg">
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="h-5"
                >
                  <div className="relative h-5 w-1 bg-white/50 rounded-full mx-auto">
                    <div
                      className={`absolute bottom-0 w-full ${getVolumeColor(volume)} rounded-full`}
                      style={{ height: `${isMuted ? 0 : volume * 100}%` }}
                    />
                    <div
                      className="absolute w-3 h-3 bg-white rounded-full -translate-x-1/2"
                      style={{ bottom: `${isMuted ? 0 : volume * 100}%` }}
                    />
                  </div>
                </Slider>
              </PopoverContent>
            </Popover>

            {/* Settings Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-white hover:bg-white/10 hover:scale-110 p-1 rounded-full">
                  <Settings size={16} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 bg-background/80 text-foreground border-muted backdrop-blur-lg">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Playback Speed</label>
                    <Select value={playbackRate.toString()} onValueChange={handleSpeedChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Speed" />
                      </SelectTrigger>
                      <SelectContent className="border-none">
                        {[0.5, 1, 1.5, 2].map(s => (
                          <SelectItem key={s} value={s.toString()}>{s}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {qualityLevels.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Quality</label>
                      <Select value={selectedQuality.toString()} onValueChange={handleQualityChange}>
                        <SelectTrigger className="bg-white/5 border-none">
                          <SelectValue placeholder="Quality" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-none">
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
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />Download
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <button onClick={handlePiP} className="text-white hover:scale-110 hover:bg-white/10 p-1 rounded-full">
              <PictureInPicture size={16} />
            </button>
            <button onClick={handleFullScreen} className="text-white hover:scale-110 hover:bg-white/10 p-1 rounded-full">
              {isFullScreen ? <Shrink size={16} /> : <Expand size={16} />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-xs text-white">{formatTime(currentTime)}</span>
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
          <span className="text-xs text-white">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
