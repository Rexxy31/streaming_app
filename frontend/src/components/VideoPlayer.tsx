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
  Settings,
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
  onToast?: (message: string) => void;
  children?: React.ReactNode;
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
  onToast,
  children,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.2);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isTouchDevice] = useState(() => 
    typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false
  );
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  // Subtitle custom controls state
  const [subsMenuOpen, setSubsMenuOpen] = useState(false);
  const [subFontSize, setSubFontSize] = useState("text-base sm:text-xl md:text-2xl");
  const [subColor, setSubColor] = useState("text-white");
  const [subBg, setSubBg] = useState("bg-black/30 backdrop-blur-sm");
  const [subPos, setSubPos] = useState({ x: 0, y: 0 });
  const subDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const handleSubPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    subDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: subPos.x,
      initialY: subPos.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSubPointerMove = (e: React.PointerEvent) => {
    if (!subDragRef.current.isDragging) return;
    e.stopPropagation();
    const dx = e.clientX - subDragRef.current.startX;
    const dy = e.clientY - subDragRef.current.startY;
    setSubPos({ x: subDragRef.current.initialX + dx, y: subDragRef.current.initialY + dy });
  };

  const handleSubPointerUp = (e: React.PointerEvent) => {
    if (!subDragRef.current.isDragging) return;
    e.stopPropagation();
    subDragRef.current.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

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
    if (videoRef.current) {
      videoRef.current.volume = volume; // Initialize browser video volume
    }
  }, []);

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
    if (seekToSeconds == null || !videoRef.current) return;
    videoRef.current.currentTime = seekToSeconds;
    // Don't call setCurrentTime(seekToSeconds) here; the video's timeupdate event will handle it
  }, [seekToSeconds]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !subsMenuOpen && !speedMenuOpen) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isPlaying, subsMenuOpen, speedMenuOpen]);

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
      onClick={(e) => {
        if (speedMenuOpen || subsMenuOpen) {
          setSpeedMenuOpen(false);
          setSubsMenuOpen(false);
          return;
        }

        const now = Date.now();
        const tapX = e.clientX;
        const rect = containerRef.current?.getBoundingClientRect();
        
        if (rect && lastTapRef.current && now - lastTapRef.current.time < 300) {
          // Double tap detected
          const relativeX = (tapX - rect.left) / rect.width;
          if (relativeX < 0.4) {
            seekBy(-10);
            onToast?.("Rewind 10s");
          } else if (relativeX > 0.6) {
            seekBy(10);
            onToast?.("Forward 10s");
          }
          lastTapRef.current = null;
          return;
        }
        
        lastTapRef.current = { time: now, x: tapX };
        if (!isTouchDevice) togglePlay();
        else setShowControls(true);
      }}
    >
      {/* Tap Overlay for Mobile Controls Toggle (since main onClick is now for double-tap) */}
      {isTouchDevice && (
        <div 
          className="absolute inset-0 z-10" 
          onClick={(e) => {
             e.stopPropagation();
             setShowControls(!showControls);
          }}
        />
      )}
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
        <div 
          className="absolute inset-x-4 bottom-24 z-20 flex justify-center sm:bottom-32"
          style={{ transform: `translate(${subPos.x}px, ${subPos.y}px)` }}
        >
          <div 
            className={`max-w-4xl rounded-2xl ${subBg} border border-white/5 px-6 py-2 text-center shadow-lg cursor-move select-none touch-none`}
            onPointerDown={handleSubPointerDown}
            onPointerMove={handleSubPointerMove}
            onPointerUp={handleSubPointerUp}
            onPointerCancel={handleSubPointerUp}
          >
            <p 
              className={`${subFontSize} font-bold leading-relaxed ${subColor} tracking-wide`}
              style={{ 
                textShadow: "0 0 4px black, 0 1px 6px black, 0 4px 16px rgba(0,0,0,0.8)",
                WebkitTextStroke: "1px rgba(0,0,0,0.4)"
              }}
            >
              {normalizeCueText(activeCue.text)}
            </p>
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
        {subsMenuOpen && hasSubtitles ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
            className="absolute left-1/2 top-1/2 z-50 w-[240px] sm:w-[280px] rounded-3xl border border-white/15 bg-black/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-white/50">Size</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { l: "S", v: "text-sm sm:text-base md:text-lg" },
                    { l: "N", v: "text-base sm:text-xl md:text-2xl" },
                    { l: "L", v: "text-lg sm:text-2xl md:text-3xl" }
                  ].map((opt) => (
                    <button key={opt.l} onClick={() => setSubFontSize(opt.v)} className={`rounded-xl py-2 text-xs font-bold transition-all ${subFontSize === opt.v ? "bg-[var(--player-accent,#a435f0)] text-white shadow-md" : "bg-white/5 text-white/60 hover:bg-white/15"}`}>{opt.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-white/50">Color</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { l: "Wht", v: "text-white" },
                    { l: "Yel", v: "text-yellow-400" },
                    { l: "Cyn", v: "text-cyan-400" }
                  ].map((opt) => (
                    <button key={opt.l} onClick={() => setSubColor(opt.v)} className={`rounded-xl py-2 text-xs font-bold transition-all ${subColor === opt.v ? "bg-[var(--player-accent,#a435f0)] text-white shadow-md" : "bg-white/5 text-white/60 hover:bg-white/15"}`}>{opt.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-white/50">Background</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { l: "None", v: "bg-transparent" },
                    { l: "Frost", v: "bg-black/30 backdrop-blur-sm" },
                    { l: "Solid", v: "bg-black/80" }
                  ].map((opt) => (
                    <button key={opt.l} onClick={() => setSubBg(opt.v)} className={`rounded-xl py-2 text-[10px] sm:text-xs font-bold transition-all ${subBg === opt.v ? "bg-[var(--player-accent,#a435f0)] text-white shadow-md" : "bg-white/5 text-white/60 hover:bg-white/15"}`}>{opt.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/50 italic text-center mt-3 border-t border-white/10 pt-3">Tip: You can drag subtitles to move them</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {speedMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
            className="absolute left-1/2 top-1/2 z-50 w-[180px] rounded-3xl border border-white/15 bg-black/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-white/50">Speed</p>
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoPlaybackRate(rate);
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  playbackRate === rate ? "bg-[var(--player-accent,#a435f0)]/30 text-white shadow-md" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <span>{rate}x</span>
                {playbackRate === rate ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {(showControls || subsMenuOpen || speedMenuOpen) && (
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
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/90 hover:border-white/30 hover:bg-black/60 backdrop-blur-md shadow-sm transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </button>
              ) : null}
            </div>

            <div className="pointer-events-auto mt-auto flex w-full flex-col gap-4 bg-black/40 p-4 backdrop-blur-xl border-t border-white/10 sm:p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-xs font-medium tabular-nums text-white/90 shadow-sm sm:text-sm">{formatTimestamp(currentTime)}</span>
                <div className="relative flex-1 group/seekbar">
                  <div className="relative h-2 sm:h-2 overflow-hidden rounded-full bg-white/18 shadow-inner">
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
                    className="absolute inset-[-10px] sm:inset-0 h-[calc(100%+20px)] sm:h-full w-[calc(100%+20px)] sm:w-full cursor-pointer opacity-0 z-20"
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
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          isActive
                            ? "border-[var(--player-accent,#a435f0)] bg-[var(--player-accent,#a435f0)]/30 text-white shadow-[0_0_12px_rgba(164,53,240,0.4)]"
                            : "border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white"
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

                  {!isTouchDevice && (
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
                  )}
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

                    <div className="relative flex gap-2 sm:gap-3">
                    {hasSubtitles && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubsMenuOpen((value) => !value);
                          setSpeedMenuOpen(false);
                        }}
                        className={`rounded-full border p-2 text-xs font-semibold transition-all ${subsMenuOpen ? 'bg-white/20 border-white/40 text-white' : 'border-white/15 text-white/90 hover:border-white/28 hover:text-white'}`}
                        title="Subtitle Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpeedMenuOpen((value) => !value);
                        setSubsMenuOpen(false);
                      }}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${speedMenuOpen ? 'bg-white/20 border-white/40 text-white' : 'border-white/15 text-white/90 hover:border-white/28 hover:text-white'}`}
                    >
                      {playbackRate}x
                    </button>
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
      {children}
    </div>
  );
}
