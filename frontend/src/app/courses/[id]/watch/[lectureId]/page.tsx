"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  Maximize2,
  NotebookPen,
  Play,
  PlayCircle,
  Search,
  Settings,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import VideoPlayer from "@/components/VideoPlayer";
import ServerSleepInfo from "@/components/ServerSleepInfo";
import {
  LectureDTO,
  CourseDTO,
  SectionDTO,
  LectureNoteDTO,
  LectureBookmarkDTO,
  createLectureBookmark,
  createLectureNote,
  deleteLectureBookmark,
  deleteLectureNote,
  fetchLectureBookmarks,
  fetchLectureSubtitle,
  fetchCourse,
  fetchLectureNotes,
  fetchStreamUrl,
  updateLectureBookmark,
  updateLectureDuration,
  updateLectureNote,
  updateProgress,
} from "@/lib/api";
import useSWR from "swr";
import { formatTimestamp, normalizeCueText, parseSubtitleText } from "@/lib/transcript";

type AccentColor = "orchid" | "gold" | "crimson" | "azure" | "mint";

const NOTE_COLORS: Record<AccentColor, string> = {
  orchid: "#a855f7",
  gold: "#eab308",
  crimson: "#ef4444",
  azure: "#3b82f6",
  mint: "#10b981",
};



export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const lectureId = params.lectureId as string;
  const shouldStartFromZero = searchParams.get("t") === "0";

  // SWR Hooks
  const { data: course, error: courseError } = useSWR(`course-${courseId}`, () => fetchCourse(courseId));
  const { data: streamUrlData } = useSWR(`stream-${lectureId}`, () => fetchStreamUrl(lectureId));
  const { data: notes, mutate: mutateNotes } = useSWR(`notes-${lectureId}`, () => fetchLectureNotes(lectureId));
  const { data: bookmarks, mutate: mutateBookmarks } = useSWR(`bookmarks-${lectureId}`, () => fetchLectureBookmarks(lectureId));
  const { data: subtitleText } = useSWR(`subtitles-${lectureId}`, () => fetchLectureSubtitle(lectureId));

  const [videoTime, setVideoTime] = useState(0);
  const latestProgressRef = useRef({ time: 0, completed: false });
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTagDraft, setNoteTagDraft] = useState("");
  const [bookmarkTagDraft, setBookmarkTagDraft] = useState("");
  const [highlightColor, setHighlightColor] = useState<AccentColor>("orchid");
  const [bookmarkColor, setBookmarkColor] = useState<AccentColor>("gold");
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editTagDraft, setEditTagDraft] = useState("");
  const [editColor, setEditColor] = useState<AccentColor>("orchid");
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const transcriptCuesParsed = useMemo(() => parseSubtitleText(subtitleText || null), [subtitleText]);
  const transcriptMatches = useMemo(() => {
    if (!transcriptSearch.trim()) return transcriptCuesParsed;
    return transcriptCuesParsed.filter((cue) => normalizeCueText(cue.text).toLowerCase().includes(transcriptSearch.toLowerCase()));
  }, [transcriptCuesParsed, transcriptSearch]);

  const allLectures = useMemo(() => {
    const flat: { lecture: LectureDTO; section: SectionDTO }[] = [];
    course?.sections?.forEach((section) => {
      section.lectures.forEach((lecture) => {
        flat.push({ lecture, section });
      });
    });
    return flat;
  }, [course]);

  const { currentLecture, currentSection } = useMemo(() => {
    const item = allLectures.find((it) => it.lecture.id === lectureId);
    return {
      currentLecture: item?.lecture ?? null,
      currentSection: item?.section ?? null,
    };
  }, [allLectures, lectureId]);

  const sidebarContent = useMemo(() => (
    <SectionSidebar 
      course={course} 
      courseId={courseId} 
      lectureId={lectureId} 
      currentSection={currentSection} 
      expandedSections={expandedSections} 
      setExpandedSections={setExpandedSections} 
    />
  ), [course, courseId, lectureId, currentSection, expandedSections]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (autoAdvanceSeconds === null) return;
    if (autoAdvanceSeconds <= 0) {
      const idx = allLectures.findIndex((it) => it.lecture.id === lectureId);
      if (idx >= 0 && idx < allLectures.length - 1) {
        router.push(`/courses/${courseId}/watch/${allLectures[idx + 1].lecture.id}`);
      }
      return;
    }
    const timer = setTimeout(() => {
      setAutoAdvanceSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoAdvanceSeconds, allLectures, courseId, lectureId, router]);

  const loading = !course && !courseError;
  const streamUrl = streamUrlData?.url ?? null;

  const handleProgress = useCallback((time: number, duration: number, isCompleted: boolean) => {
    latestProgressRef.current = { time, completed: isCompleted };
    setVideoTime(time);
    if (duration > 0 && currentLecture && (!currentLecture.durationSeconds || currentLecture.durationSeconds === 0)) {
      updateLectureDuration(lectureId, Math.floor(duration));
    }
  }, [currentLecture, lectureId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const { time, completed } = latestProgressRef.current;
      if (time > 0) {
        updateProgress(lectureId, Math.floor(time), completed).catch((error) => console.error("Progress sync failed", error));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [lectureId]);

  useEffect(() => {
    function handleBeforeUnload() {
      const { time, completed } = latestProgressRef.current;
      if (time > 0) {
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL}/progress`,
          new Blob([JSON.stringify({ lectureId, lastPositionSeconds: Math.floor(time), completed })], {
            type: "application/json",
          })
        );
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lectureId]);

  const jumpToTime = (timeSeconds: number) => {
    setSeekToSeconds(null);
    window.setTimeout(() => setSeekToSeconds(timeSeconds), 0);
    setToast(`Jumped to ${formatTimestamp(timeSeconds)}`);
  };

  const handleVideoEnded = () => {
    const { time } = latestProgressRef.current;
    updateProgress(lectureId, Math.floor(time || 0), true).catch(console.error);
    const idx = allLectures.findIndex((item) => item.lecture.id === lectureId);
    if (idx >= 0 && idx < allLectures.length - 1) setAutoAdvanceSeconds(5);
  };

  const addNote = async () => {
    if (!noteDraft.trim()) return;
    const time = Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0);
    const tags = noteTagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await createLectureNote(lectureId, { timeSeconds: time, text: noteDraft, tags, highlightColor });
      setNoteDraft("");
      setNoteTagDraft("");
      mutateNotes();
      setToast("Note pinned to timeline");
    } catch (err) {
      console.error("Failed to create note", err);
    }
  };

  const addBookmark = async () => {
    const time = Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0);
    const tags = bookmarkTagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    const label = bookmarkTagDraft.trim() || `Bookmark at ${formatTimestamp(time)}`;
    try {
      await createLectureBookmark(lectureId, { timeSeconds: time, label, tags, highlightColor: bookmarkColor });
      setBookmarkTagDraft("");
      mutateBookmarks();
      setToast("Timestamp saved");
    } catch (err) {
      console.error("Failed to create bookmark", err);
    }
  };

  const startEditingNote = (note: LectureNoteDTO) => {
    setEditingNoteId(note.id);
    setEditDraft(note.text);
    setEditTagDraft(note.tags.join(", "));
    setEditColor((note.highlightColor as AccentColor) || "orchid");
  };

  const saveNoteEdit = async () => {
    if (!editingNoteId) return;
    const tags = editTagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await updateLectureNote(editingNoteId, { text: editDraft, tags, highlightColor: editColor, timeSeconds: notes?.find(n => n.id === editingNoteId)?.timeSeconds || 0 });
    if (res) {
      setEditingNoteId(null);
      mutateNotes();
      setToast("Note updated");
    }
  };

  const startEditingBookmark = (bookmark: LectureBookmarkDTO) => {
    setEditingBookmarkId(bookmark.id);
    setEditDraft(bookmark.label);
    setEditTagDraft(bookmark.tags.join(", "));
    setEditColor((bookmark.highlightColor as AccentColor) || "gold");
  };

  const saveBookmarkEdit = async () => {
    if (!editingBookmarkId) return;
    const tags = editTagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await updateLectureBookmark(editingBookmarkId, { label: editDraft, tags, highlightColor: editColor, timeSeconds: bookmarks?.find(b => b.id === editingBookmarkId)?.timeSeconds || 0 });
    if (res) {
      setEditingBookmarkId(null);
      mutateBookmarks();
      setToast("Bookmark updated");
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0b] text-white overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] px-6 py-4 text-sm font-semibold text-[var(--text)] backdrop-blur-xl shadow-[var(--shadow-card)]">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-strong)] px-4 md:px-6 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <Link href={`/courses/${courseId}`} className="group flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] transition-all hover:bg-[var(--accent)] hover:text-white">
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </Link>
          <div className="min-w-0">
            <p className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)] dark:text-[var(--accent)]">Watching</p>
            <h1 className="text-sm font-bold text-[var(--text)] line-clamp-1">{currentLecture?.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/" className="btn-secondary h-9 md:h-10 border-[var(--border)] bg-[var(--surface)] px-3 md:px-4 text-[10px] md:text-sm font-semibold hover:bg-[var(--surface-dark-soft)] hover:text-white transition-colors">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <button 
            onClick={() => {
              if (window.innerWidth < 1280) setMobileSidebarOpen(true);
              else setSidebarOpen(!sidebarOpen);
            }} 
            className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-[var(--bg-muted)] transition-all hover:bg-[var(--accent-wash)] text-[var(--text-muted)] hover:text-[var(--accent-strong)]"
          >
            {window.innerWidth < 1280 ? <NotebookPen className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col xl:flex-row overflow-hidden md:overflow-visible relative">
        {/* Main Player Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg)] xl:overflow-y-auto scroll-smooth">
          <div className="mx-auto max-w-[1400px] p-0 md:p-6 lg:p-10">
            <div className="sticky top-14 z-30 md:static md:z-0 aspect-video w-full overflow-hidden md:rounded-[32px] border-b md:border border-white/10 bg-black shadow-2xl">
              {streamUrl ? (
                <VideoPlayer
                  src={streamUrl}
                  title={currentLecture?.title || "Lecture"}
                  subtitleText={subtitleText}
                  onProgress={handleProgress}
                  onEnded={handleVideoEnded}
                  initialTime={shouldStartFromZero ? 0 : (currentLecture?.lastPositionSeconds || 0)}
                  seekToSeconds={seekToSeconds}
                  onToast={(msg) => setToast(msg)}
                >
                  {autoAdvanceSeconds !== null && (
                    (() => {
                      const idx = allLectures.findIndex(it => it.lecture.id === lectureId);
                      const nextLecture = idx >= 0 && idx < allLectures.length - 1 ? allLectures[idx+1].lecture : null;
                      if (!nextLecture) return null;
                      return (
                        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
                          <div className="flex flex-col items-center text-center w-[90%] max-w-md p-10 rounded-3xl border border-white/10 bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl">
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50 mb-8">Up Next</p>
                            
                            <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
                              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                              <svg className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none">
                                <circle 
                                  cx="56" cy="56" r="54" 
                                  fill="transparent" 
                                  stroke="var(--player-accent,#a435f0)" 
                                  strokeWidth="4" 
                                  strokeDasharray="339.29" 
                                  strokeDashoffset={(339.29 * (5 - autoAdvanceSeconds)) / 5} 
                                  className="transition-all duration-1000 ease-linear" 
                                />
                              </svg>
                              <span className="text-4xl font-extrabold text-white tabular-nums drop-shadow-lg">{autoAdvanceSeconds}</span>
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2 leading-tight line-clamp-2">{nextLecture.title}</h3>
                            <p className="text-sm font-medium text-white/50 mb-6">{nextLecture.durationSeconds ? formatTimestamp(nextLecture.durationSeconds) : ""}</p>

                            <div className="flex flex-col gap-3 w-full mt-2">
                              {nextLecture.lastPositionSeconds && nextLecture.lastPositionSeconds > 5 ? (
                                <div className="flex gap-3 w-full">
                                  <button onClick={() => {
                                    router.push(`/courses/${courseId}/watch/${nextLecture.id}`);
                                  }} className="flex-1 rounded-2xl bg-[var(--player-accent,#a435f0)] px-4 py-3.5 text-xs font-bold text-white hover:brightness-110 shadow-[0_0_20px_rgba(164,53,240,0.4)] transition-all truncate">Resume</button>
                                  <button onClick={() => {
                                    router.push(`/courses/${courseId}/watch/${nextLecture.id}?t=0`);
                                  }} className="flex-1 rounded-2xl bg-white/10 px-4 py-3.5 text-xs font-bold text-white hover:bg-white/20 transition-all border border-white/10 truncate">Start Over</button>
                                </div>
                              ) : (
                                <button onClick={() => {
                                  router.push(`/courses/${courseId}/watch/${nextLecture.id}`);
                                }} className="w-full rounded-2xl bg-[var(--player-accent,#a435f0)] px-6 py-3.5 text-sm font-bold text-white hover:brightness-110 shadow-[0_0_20px_rgba(164,53,240,0.4)] transition-all">Play Now</button>
                              )}
                              <button onClick={() => setAutoAdvanceSeconds(null)} className="w-full rounded-2xl bg-transparent px-6 py-3 text-xs font-bold text-white/50 hover:text-white transition-all">Cancel Auto-Play</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </VideoPlayer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
                    <p className="text-sm text-white/56">Requesting secure stream...</p>
                  </div>
                </div>
              )}
            </div>

              <div className="mt-6 md:mt-10">
                <div className="flex flex-col gap-4 md:gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-3xl font-extrabold text-[var(--text)] md:text-4xl lg:text-5xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {currentLecture?.title}
                    </h2>
                    <div className="mt-5 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--text)] shadow-sm">
                        <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {currentLecture?.durationSeconds ? `${Math.floor(currentLecture.durationSeconds / 60)} minutes` : "Loading duration"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-semibold">
                        <span className="font-bold text-[var(--accent-strong)] dark:text-[var(--accent)]">{currentSection?.title}</span>
                        <span>&bull;</span>
                        <span>Enrolled Library</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors shadow-sm">
                      <Share2 className="h-5 w-5" />
                    </button>
                    <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors shadow-sm">
                      <Settings className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-10 h-px bg-[var(--border)]" />

                <div className="mt-8 grid gap-8 2xl:grid-cols-[1fr_0.95fr]">
                  <section className="glass-card rounded-[32px] border-[var(--border)] bg-[var(--surface-strong)] p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[var(--accent)]/10 p-3 text-[var(--accent-strong)] dark:text-[var(--accent)]"><NotebookPen className="h-6 w-6" /></div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] hidden sm:block">Lecture notes</p>
                        <h3 className="mt-1 text-2xl font-bold text-[var(--text)] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Notes & Moments</h3>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-inner">
                        <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Capture a takeaway..." className="h-24 md:h-32 w-full resize-none bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/50" />
                        <div className="mt-4 grid gap-3">
                          <input value={noteTagDraft} onChange={(event) => setNoteTagDraft(event.target.value)} placeholder="Tags: api, revisit" className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/60 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm" />
                          <div className="flex flex-wrap items-center gap-2">
                            {Object.entries(NOTE_COLORS).map(([name, value]) => (
                              <button key={name} type="button" onClick={() => setHighlightColor(name as AccentColor)} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${highlightColor === name ? "border-[var(--text)] shadow-md scale-110" : "border-transparent"}`} style={{ backgroundColor: value }} />
                            ))}
                          </div>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                          <p className="text-xs font-bold text-[var(--text-muted)]">Linked to {formatTimestamp(Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0))}</p>
                          <button onClick={addNote} className="btn-primary px-6 py-3 text-sm shadow-[0_4px_14px_var(--accent-wash)] hover:shadow-[0_6px_20px_var(--accent-wash)]">Save note</button>
                        </div>
                        <ServerSleepInfo className="mt-4 bg-transparent border-none p-0" />
                      </div>

                      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-inner flex flex-col">
                        <p className="text-base font-bold text-[var(--text)]">Quick Bookmark</p>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Drop a timestamp marker with a tag to quickly revisit key concepts.</p>
                        <div className="mt-5 grid gap-3">
                          <input value={bookmarkTagDraft} onChange={(event) => setBookmarkTagDraft(event.target.value)} placeholder="Tags: recap, example" className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/60 focus:border-[var(--accent)] transition-all shadow-sm" />
                          <div className="flex flex-wrap items-center gap-2">
                            {Object.entries(NOTE_COLORS).map(([name, value]) => (
                              <button key={`bookmark-${name}`} type="button" onClick={() => setBookmarkColor(name as AccentColor)} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${bookmarkColor === name ? "border-[var(--text)] shadow-md scale-110" : "border-transparent"}`} style={{ backgroundColor: value }} />
                            ))}
                          </div>
                        </div>
                        <div className="mt-auto pt-6">
                            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-4 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Position</p>
                                <p className="mt-1 text-xl font-extrabold text-[var(--text)] tracking-tight">{formatTimestamp(Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0))}</p>
                            </div>
                            <button onClick={addBookmark} className="btn-secondary mt-3 w-full border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-bold shadow-sm hover:bg-[var(--surface-dark-soft)] hover:text-white transition-all">Save timestamp</button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-6 xl:grid-cols-2">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <p className="text-sm font-extrabold tracking-wide text-[var(--text)] uppercase">Pinned Notes</p>
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{notes?.length || 0} items</span>
                        </div>
                        {(notes || []).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)]/50 p-10 text-center">
                            <p className="text-sm font-medium text-[var(--text-muted)]">No notes yet. Capture something important!</p>
                          </div>
                        ) : (
                          notes?.map((note) => (
                            <div key={note.id} className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:bg-[var(--surface-strong)] hover:shadow-md hover:border-[var(--border-strong)]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <button onClick={() => jumpToTime(note.timeSeconds)} className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-bold text-[var(--accent-strong)] dark:text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors">
                                    <Play className="h-3 w-3 fill-current" />
                                    {formatTimestamp(note.timeSeconds)}
                                  </button>
                                  {note.highlightColor && (
                                    <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: NOTE_COLORS[note.highlightColor as AccentColor] }} />
                                  )}
                                </div>
                                <div className="flex gap-1.5 opacity-0 transition-all group-hover:opacity-100">
                                  <button onClick={() => startEditingNote(note)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"><Settings className="h-4 w-4" /></button>
                                  <button onClick={() => { if(confirm("Delete this note?")) { deleteLectureNote(note.id); mutateNotes(); } }} className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                </div>
                              </div>
                              
                              {editingNoteId === note.id ? (
                                <div className="mt-5 space-y-4 animate-in fade-in slide-in-from-top-2 bg-[var(--bg-muted)] p-4 rounded-xl border border-[var(--border)]">
                                  <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="w-full min-h-[80px] bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl p-3 text-sm font-medium outline-none text-[var(--text)] focus:border-[var(--accent)] shadow-inner" />
                                  <input value={editTagDraft} onChange={(e) => setEditTagDraft(e.target.value)} placeholder="Tags..." className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-medium outline-none text-[var(--text)] focus:border-[var(--accent)] shadow-inner" />
                                  <div className="flex items-center justify-between pt-2">
                                    <div className="flex gap-2">
                                      {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                        <button key={`edit-note-${name}`} onClick={() => setEditColor(name as AccentColor)} className={`h-6 w-6 rounded-full border-2 transition-transform ${editColor === name ? "border-[var(--text)] scale-110" : "border-transparent"}`} style={{ backgroundColor: value }} />
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => setEditingNoteId(null)} className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
                                      <button onClick={saveNoteEdit} className="btn-primary px-4 py-2 text-xs">Save</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="mt-4 text-[15px] font-medium leading-relaxed text-[var(--text)]">{note.text}</p>
                                  {note.tags.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {note.tags.map((tag: string) => (
                                        <span key={tag} className="rounded-md bg-[var(--bg-muted)]/80 border border-[var(--border)] px-2 py-1 text-[11px] font-bold text-[var(--text-muted)]">#{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <p className="text-sm font-extrabold tracking-wide text-[var(--text)] uppercase">Saved Moments</p>
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{bookmarks?.length || 0} items</span>
                        </div>
                        {(bookmarks || []).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)]/50 p-10 text-center">
                            <p className="text-sm font-medium text-[var(--text-muted)]">Keep track of key chapters.</p>
                          </div>
                        ) : (
                          bookmarks?.map((bookmark) => (
                            <div key={bookmark.id} className="group relative flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:bg-[var(--surface-strong)] hover:shadow-md hover:border-[var(--border-strong)]">
                              <div className="flex items-center gap-4">
                                <button onClick={() => jumpToTime(bookmark.timeSeconds)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent-strong)] dark:text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors">
                                  <PlayCircle className="h-5 w-5" />
                                </button>
                                
                                {editingBookmarkId === bookmark.id ? (
                                  <div className="flex-1 space-y-2.5 py-1">
                                    <input value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="w-full bg-[var(--surface-strong)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm font-medium outline-none text-[var(--text)] focus:border-[var(--accent)] shadow-inner" />
                                    <div className="flex items-center gap-3">
                                      <div className="flex gap-2">
                                        {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                          <button key={`edit-bm-${name}`} onClick={() => setEditColor(name as AccentColor)} className={`h-5 w-5 rounded-full transition-transform ${editColor === name ? "ring-2 ring-[var(--text)] scale-110" : ""}`} style={{ backgroundColor: value }} />
                                        ))}
                                      </div>
                                      <div className="flex gap-3 ml-auto">
                                        <button onClick={() => setEditingBookmarkId(null)} className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
                                        <button onClick={saveBookmarkEdit} className="text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-strong)]">Save</button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent-strong)] dark:group-hover:text-[var(--accent)] transition-colors">{bookmark.label}</p>
                                    <p className="mt-1 text-[11px] font-semibold text-[var(--text-muted)]">{formatTimestamp(bookmark.timeSeconds)} &bull; {bookmark.tags.join(", ") || "No tags"}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 opacity-0 transition-all group-hover:opacity-100">
                                <button onClick={() => startEditingBookmark(bookmark)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"><Settings className="h-4 w-4" /></button>
                                <button onClick={() => { if(confirm("Delete bookmark?")) { deleteLectureBookmark(bookmark.id); mutateBookmarks(); } }} className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                  </div>
                </section>

                <section className="glass-card rounded-[32px] border-[var(--border)] bg-[var(--surface-strong)] p-6 md:p-8 flex flex-col shadow-sm">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3 text-[var(--text-muted)]"><Search className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Smart Transcript Search</p>
                      <input 
                        type="text" 
                        placeholder="Type to jump to a topic..." 
                        className="mt-1 w-full bg-transparent text-xl font-extrabold text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/50 focus:border-b-2 focus:border-[var(--accent)] transition-all pb-1"
                        value={transcriptSearch}
                        onChange={(e) => setTranscriptSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {transcriptMatches.map((cue, idx) => (
                      <button 
                        key={`cue-${idx}`} 
                        onClick={() => jumpToTime(cue.start)}
                        className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:bg-[var(--surface-dark-soft)] hover:border-[var(--border-strong)] hover:shadow-md group"
                      >
                        <div className="flex justify-between items-start gap-5">
                           <p className="text-sm font-medium leading-relaxed text-[var(--text-muted)] group-hover:text-white transition-colors">{normalizeCueText(cue.text)}</p>
                           <span className="rounded-md bg-[var(--accent-wash)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--accent-strong)] dark:text-[var(--accent)] shrink-0">{formatTimestamp(cue.start)}</span>
                        </div>
                      </button>
                    ))}
                    {transcriptMatches.length === 0 && (
                      <div className="py-24 text-center">
                        <Search className="mx-auto h-10 w-10 text-[var(--text-muted)]/30" />
                        <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Transcript matches will appear as you type.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-[60] xl:hidden">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute right-0 top-0 h-full w-[85%] max-w-[400px] border-l border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl animate-in slide-in-from-right duration-300">
               {sidebarContent}
            </aside>
          </div>
        )}

        {/* Desktop Sidebar - Course Rail */}
        {sidebarOpen && (
          <aside className="w-[400px] shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto custom-scrollbar hidden xl:block shadow-[-10px_0_30px_rgba(0,0,0,0.02)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
            {sidebarContent}
          </aside>
        )}
      </div>
    </div>
  );
}

interface SectionSidebarProps {
  course: CourseDTO | null | undefined;
  courseId: string;
  lectureId: string;
  currentSection: SectionDTO | null;
  expandedSections: Set<string>;
  setExpandedSections: (sections: Set<string>) => void;
}

function SectionSidebar({ course, courseId, lectureId, currentSection, expandedSections, setExpandedSections }: SectionSidebarProps) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--border)]">
        <h3 className="text-xl font-extrabold text-[var(--text)] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Course Index</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Rail View</span>
      </div>

      <div className="space-y-8">
        {(course?.sections || []).map((section: SectionDTO) => {
          const isSectionExpanded = expandedSections.has(section.id) || section.id === currentSection?.id;
          return (
            <div key={section.id} className="space-y-3">
              <button 
                onClick={() => {
                  const next = new Set(expandedSections);
                  if (next.has(section.id)) {
                      next.delete(section.id);
                  } else {
                      next.add(section.id);
                  }
                  setExpandedSections(next);
                }}
                className="flex w-full items-center justify-between text-left group"
              >
                <span className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent-strong)] dark:group-hover:text-[var(--accent)] transition-colors uppercase tracking-[0.1em]">{section.title}</span>
                {isSectionExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text)]" />}
              </button>
              
              {isSectionExpanded && (
                <div className="space-y-1.5 pt-2 animate-in fade-in slide-in-from-top-1">
                  {section.lectures.map((lecture) => (
                    <Link 
                      key={lecture.id}
                      href={`/courses/${courseId}/watch/${lecture.id}`}
                      className={`flex items-center gap-4 rounded-[16px] px-4 py-3.5 transition-all ${
                        lecture.id === lectureId 
                          ? "bg-[var(--surface-strong)] border border-[var(--border-strong)] shadow-[0_4px_12px_var(--accent-wash)]" 
                          : "hover:bg-[var(--surface-strong)] border border-transparent hover:border-[var(--border)] hover:shadow-sm"
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm ${
                        lecture.completed ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                      }`}>
                        {lecture.id === lectureId ? <PlayCircle className="h-5 w-5 fill-[var(--accent)] text-white dark:text-[var(--bg)]" /> : <PlayCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold line-clamp-1 ${lecture.id === lectureId ? "text-[var(--text)]" : "text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors"}`}>{lecture.title}</p>
                          <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-1">{lecture.durationSeconds ? formatTimestamp(lecture.durationSeconds) : "--:--"}</p>
                      </div>
                      {lecture.id === lectureId && <Sparkles className="h-4 w-4 text-[var(--accent-strong)] dark:text-[var(--accent)]" />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
