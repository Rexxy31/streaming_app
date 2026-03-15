"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Forward,
  Maximize,
  Minimize,
  Loader2,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
  Captions,
} from "lucide-react";
import { formatTimestamp, normalizeCueText, parseSubtitleText } from "@/lib/transcript";

interface ChapterMarker {
  timeSeconds: number;
  label: string;
}

interface VideoPlayerProps {
  src: string;
  subtitleText?: string | null;
  title?: string;
  autoPlay?: boolean;
  onProgress?: (time: number, duration: number, isCompleted: boolean) => void;
  onEnded?: () => void;
  onDurationLoaded?: (duration: number) => void;
  initialTime?: number;
  seekToSeconds?: number | null;
  chapters?: ChapterMarker[];
  onCopyTimestampLink?: (seconds: number) => void;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoPlayer({
  src,
  subtitleText = null,
  title,
  autoPlay = true,
  onProgress,
  onEnded,
  onDurationLoaded,
  initialTime = 0,
  seekToSeconds = null,
  chapters = [],
  onCopyTimestampLink,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const subtitleCues = useMemo(() => parseSubtitleText(subtitleText), [subtitleText]);
  const activeCue = useMemo(
    () => subtitleCues.find((cue) => currentTime >= cue.start && currentTime <= cue.end) ?? null,
    [currentTime, subtitleCues]
  );
  const activeChapter = useMemo(() => {
    const sorted = [...chapters].sort((a, b) => a.timeSeconds - b.timeSeconds);
    return sorted.filter((chapter) => chapter.timeSeconds <= currentTime).at(-1) ?? sorted[0] ?? null;
  }, [chapters, currentTime]);
  const hasSubtitles = subtitleCues.length > 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      onDurationLoaded?.(video.duration);
      if (initialTime > 0) {
        video.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [initialTime, onDurationLoaded]);

  useEffect(() => {
    if (seekToSeconds === null || !videoRef.current) return;
    videoRef.current.currentTime = seekToSeconds;
    setCurrentTime(seekToSeconds);
  }, [seekToSeconds]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((error) => console.error("Playback failed", error));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(time);
    onProgress?.(time, dur, dur > 0 && time / dur >= 0.9);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const seekBy = useCallback((delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + delta);
    setCurrentTime(videoRef.current.currentTime);
  }, []);

  const jumpToChapter = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      if (vol > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch((err) => console.log(err));
    } else {
      await document.exitFullscreen().catch((err) => console.log(err));
    }
  }, []);

  const setVideoPlaybackRate = useCallback((rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setSpeedMenuOpen(false);
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!hasSubtitles) return;
    setCaptionsEnabled((value) => !value);
  }, [hasSubtitles]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "arrowleft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "arrowright":
          e.preventDefault();
          seekBy(5);
          break;
        case ".":
          e.preventDefault();
          setVideoPlaybackRate(PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(playbackRate) + 1) % PLAYBACK_RATES.length]);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playbackRate, seekBy, setVideoPlaybackRate, toggleFullscreen, toggleMute, togglePlay]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full max-w-full flex-col justify-center overflow-hidden bg-black group ${
        isFullscreen ? "h-screen" : "rounded-none shadow-2xl ring-1 ring-white/10"
      }`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        className="h-full w-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onPlay={() => {
          setIsPlaying(true);
          handleMouseMove();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        playsInline
      />

      {captionsEnabled && activeCue ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center sm:inset-x-4 sm:bottom-28">
          <div className="w-full rounded-2xl bg-black/78 px-3 py-2 text-center text-xs font-medium leading-5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] sm:max-w-3xl sm:px-4 sm:text-sm">
            <p>{normalizeCueText(activeCue.text)}</p>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-[var(--player-accent,#a435f0)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 flex flex-col justify-between bg-black/30 pointer-events-none"
          >
            <div className="flex items-center justify-between p-4 sm:p-6">
              <div>
                {title ? <h2 className="text-lg font-semibold tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-xl">{title}</h2> : null}
                {activeChapter ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/62">{activeChapter.label}</p> : null}
              </div>
              {onCopyTimestampLink ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyTimestampLink(Math.floor(currentTime));
                  }}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-3 py-2 text-xs font-semibold text-white/88 hover:border-white/24 hover:bg-black/45"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </button>
              ) : null}
            </div>

            <div className="pointer-events-auto mt-auto flex w-full flex-col gap-4 bg-black/22 p-3 backdrop-blur-sm sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-xs font-medium tabular-nums text-white/90 shadow-sm sm:text-sm">{formatTimestamp(currentTime)}</span>
                <div className="relative flex-1">
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/18 shadow-inner">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--player-accent,#a435f0)]"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      layout
                    />
                    {chapters.map((chapter) => (
                      <button
                        key={`${chapter.label}-${chapter.timeSeconds}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          jumpToChapter(chapter.timeSeconds);
                        }}
                        className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-black/70"
                        style={{ left: `${duration > 0 ? (chapter.timeSeconds / duration) * 100 : 0}%` }}
                        title={`${chapter.label} (${formatTimestamp(chapter.timeSeconds)})`}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-white/90 shadow-sm sm:text-sm">{formatTimestamp(duration)}</span>
              </div>

              {chapters.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {chapters.map((chapter) => {
                    const isActive = activeChapter?.timeSeconds === chapter.timeSeconds;
                    return (
                      <button
                        key={`${chapter.label}-chip-${chapter.timeSeconds}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          jumpToChapter(chapter.timeSeconds);
                        }}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                          isActive
                            ? "border-[var(--player-accent,#a435f0)] bg-[color:var(--player-accent,#a435f0)]/20 text-white"
                            : "border-white/12 bg-white/6 text-white/70 hover:border-white/24 hover:text-white"
                        }`}
                      >
                        {formatTimestamp(chapter.timeSeconds)} {chapter.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      seekBy(-10);
                    }}
                    className="text-white/80 transition-colors hover:text-[var(--player-accent,#a435f0)]"
                  >
                    <Rewind className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="text-white transition-colors hover:text-[var(--player-accent,#a435f0)]"
                  >
                    {isPlaying ? <Pause className="h-7 w-7 fill-current sm:h-8 sm:w-8" /> : <Play className="h-7 w-7 fill-current sm:h-8 sm:w-8" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      seekBy(10);
                    }}
                    className="text-white/80 transition-colors hover:text-[var(--player-accent,#a435f0)]"
                  >
                    <Forward className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="text-white transition-colors hover:text-[var(--player-accent,#a435f0)]"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" /> : <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 cursor-pointer accent-[var(--player-accent,#a435f0)] sm:w-24"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {hasSubtitles ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCaptions();
                      }}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        captionsEnabled
                          ? "border-[var(--player-accent,#a435f0)] text-white"
                          : "border-white/15 text-white/90 hover:border-white/28 hover:text-white"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Captions className="h-3.5 w-3.5" />
                        CC
                      </span>
                    </button>
                  ) : null}

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpeedMenuOpen((value) => !value);
                      }}
                      className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 hover:border-white/28 hover:text-white"
                    >
                      {playbackRate}x
                    </button>
                    <AnimatePresence>
                      {speedMenuOpen ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="absolute bottom-12 right-0 z-20 min-w-[120px] rounded-2xl border border-white/10 bg-[#121212]/96 p-2 shadow-[0_18px_42px_rgba(0,0,0,0.4)]"
                        >
                          {PLAYBACK_RATES.map((rate) => (
                            <button
                              key={rate}
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoPlaybackRate(rate);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${
                                playbackRate === rate ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
                              }`}
                            >
                              <span>{rate}x</span>
                              {playbackRate === rate ? <Check className="h-4 w-4" /> : null}
                            </button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="text-white transition-colors hover:text-[var(--player-accent,#a435f0)]"
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5 sm:h-6 sm:w-6" /> : <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
