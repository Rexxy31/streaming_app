"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  deleteLectureBookmark,
  deleteLectureNote,
  fetchLectureBookmarks,
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
  const courseId = params.id as string;
  const lectureId = params.lectureId as string;

  // SWR Hooks
  const { data: course, error: courseError } = useSWR(`course-${courseId}`, () => fetchCourse(courseId));
  const { data: streamUrlData } = useSWR(`stream-${lectureId}`, () => fetchStreamUrl(lectureId));
  const { data: notes, mutate: mutateNotes } = useSWR(`notes-${lectureId}`, () => fetchLectureNotes(lectureId));
  const { data: bookmarks, mutate: mutateBookmarks } = useSWR(`bookmarks-${lectureId}`, () => fetchLectureBookmarks(lectureId));
  const { data: subtitleText } = useSWR(`subtitles-${lectureId}`, async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lectures/${lectureId}/subtitles`);
    if (!res.ok) return null;
    return res.text();
  });

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
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/learning/lectures/${lectureId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeSeconds: time, text: noteDraft, tags, highlightColor }),
    });

    if (res.ok) {
      setNoteDraft("");
      setNoteTagDraft("");
      mutateNotes();
      setToast("Note pinned to timeline");
    }
  };

  const addBookmark = async () => {
    const time = Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0);
    const tags = bookmarkTagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    const label = bookmarkTagDraft.trim() || `Bookmark at ${formatTimestamp(time)}`;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/learning/lectures/${lectureId}/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeSeconds: time, label, tags, highlightColor: bookmarkColor }),
    });

    if (res.ok) {
      setBookmarkTagDraft("");
      mutateBookmarks();
      setToast("Timestamp saved");
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
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/80 px-6 py-4 text-sm font-medium text-white backdrop-blur-xl shadow-2xl">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between border-b border-white/8 bg-[#0a0a0b]/80 px-4 md:px-6 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <Link href={`/courses/${courseId}`} className="group flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10">
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-white/70 group-hover:text-white" />
          </Link>
          <div className="min-w-0">
            <p className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-soft-strong)]">Watching</p>
            <h1 className="text-sm font-bold text-white line-clamp-1">{currentLecture?.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/" className="btn-secondary h-9 md:h-10 border-white/10 bg-white/5 px-3 md:px-4 text-[10px] md:text-xs hover:bg-white/10">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <button 
            onClick={() => {
              if (window.innerWidth < 1280) setMobileSidebarOpen(true);
              else setSidebarOpen(!sidebarOpen);
            }} 
            className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10"
          >
            {window.innerWidth < 1280 ? <NotebookPen className="h-4 w-4 text-white/70" /> : <Maximize2 className="h-4 w-4 text-white/70" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col xl:flex-row overflow-hidden md:overflow-visible relative">
        {/* Main Player Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 xl:overflow-y-auto scroll-smooth">
          <div className="mx-auto max-w-[1400px] p-0 md:p-6 lg:p-10">
            <div className="sticky top-14 z-30 md:static md:z-0 aspect-video w-full overflow-hidden md:rounded-[32px] border-b md:border border-white/10 bg-black shadow-2xl">
              {streamUrl ? (
                <VideoPlayer
                  src={streamUrl}
                  title={currentLecture?.title || "Lecture"}
                  onProgress={handleProgress}
                  onEnded={handleVideoEnded}
                  initialTime={currentLecture?.lastPositionSeconds || 0}
                  seekToSeconds={seekToSeconds}
                  onToast={(msg) => setToast(msg)}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
                    <p className="text-sm text-white/56">Requesting secure stream...</p>
                  </div>
                </div>
              )}

              {autoAdvanceSeconds !== null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Next lecture starting</p>
                    <p className="mt-4 text-6xl font-black text-white">{autoAdvanceSeconds}</p>
                    <div className="mt-8 flex gap-4">
                      <button onClick={() => setAutoAdvanceSeconds(null)} className="btn-secondary border-white/10 bg-white/5 px-6">Cancel</button>
                      <button onClick={() => {
                        const idx = allLectures.findIndex(it => it.lecture.id === lectureId);
                        if (idx >= 0 && idx < allLectures.length - 1) router.push(`/courses/${courseId}/watch/${allLectures[idx+1].lecture.id}`);
                      }} className="btn-primary px-6">Play Now</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 md:mt-8">
              <div className="flex flex-col gap-4 md:gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white md:text-3xl lg:text-4xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                    {currentLecture?.title}
                  </h2>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80">
                      <Clock3 className="h-3.5 w-3.5" />
                      {currentLecture?.durationSeconds ? `${Math.floor(currentLecture.durationSeconds / 60)} minutes` : "Loading duration"}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/45">
                      <span className="font-bold text-[var(--accent)]">{currentSection?.title}</span>
                      <span>&bull;</span>
                      <span>Enrolled Library</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-10 h-px bg-white/8" />

              <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_0.95fr]">
                <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[var(--accent-wash)] p-3 text-[var(--accent-soft-strong)]"><NotebookPen className="h-5 w-5" /></div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-soft-strong)]">Lecture notes</p>
                      <h3 className="mt-1 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display), sans-serif" }}>Notes and saved moments</h3>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                      <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Capture a takeaway..." className="h-24 md:h-32 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
                      <div className="mt-4 grid gap-3">
                        <input value={noteTagDraft} onChange={(event) => setNoteTagDraft(event.target.value)} placeholder="Tags: api, revisit" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 md:py-3 text-sm text-white outline-none placeholder:text-white/35" />
                        <div className="flex flex-wrap items-center gap-2">
                          {Object.entries(NOTE_COLORS).map(([name, value]) => (
                            <button key={name} type="button" onClick={() => setHighlightColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${highlightColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-white/56">Linked to {formatTimestamp(Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0))}</p>
                        <button onClick={addNote} className="btn-primary px-4 py-3 text-xs">Save note</button>
                      </div>
                      <ServerSleepInfo className="mt-4 bg-transparent border-white/5" />
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white">Quick bookmark</p>
                      <p className="mt-2 text-sm leading-6 text-white/52">Drop a timestamp marker with a tag set and color, then revisit it from your study guide or chapter rail.</p>
                      <div className="mt-4 grid gap-2 md:gap-3">
                        <input value={bookmarkTagDraft} onChange={(event) => setBookmarkTagDraft(event.target.value)} placeholder="Tags: recap, example" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 md:py-3 text-sm text-white outline-none placeholder:text-white/35" />
                        <div className="flex flex-wrap items-center gap-2">
                          {Object.entries(NOTE_COLORS).map(([name, value]) => (
                            <button key={`bookmark-${name}`} type="button" onClick={() => setBookmarkColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${bookmarkColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">Current position</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatTimestamp(Math.floor(videoTime || currentLecture?.lastPositionSeconds || 0))}</p>
                      </div>
                      <button onClick={addBookmark} className="btn-secondary mt-4 w-full border-white/10 bg-white/8 px-4 py-3 text-sm text-white hover:bg-white/12">Save current timestamp</button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">Pinned Notes</p>
                        <span className="text-[10px] uppercase font-bold text-white/40">{notes?.length || 0} items</span>
                      </div>
                      {(notes || []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                          <p className="text-xs text-white/40">No notes yet. Capture something important!</p>
                        </div>
                      ) : (
                        notes?.map((note) => (
                          <div key={note.id} className="group relative rounded-2xl border border-white/8 bg-white/5 p-4 transition-all hover:bg-white/8">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => jumpToTime(note.timeSeconds)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-[var(--accent)]">
                                  <Play className="h-2.5 w-2.5 fill-current" />
                                  {formatTimestamp(note.timeSeconds)}
                                </button>
                                {note.highlightColor && (
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: NOTE_COLORS[note.highlightColor as AccentColor] }} />
                                )}
                              </div>
                              <div className="flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                                <button onClick={() => startEditingNote(note)} className="p-1 text-white/50 hover:text-white"><Settings className="h-3.5 w-3.5" /></button>
                                <button onClick={() => { if(confirm("Delete this note?")) { deleteLectureNote(note.id); mutateNotes(); } }} className="p-1 text-white/50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            
                            {editingNoteId === note.id ? (
                              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="w-full min-h-[80px] bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)]" />
                                <input value={editTagDraft} onChange={(e) => setEditTagDraft(e.target.value)} placeholder="Tags..." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-[var(--accent)]" />
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-1.5">
                                    {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                      <button key={`edit-note-${name}`} onClick={() => setEditColor(name as AccentColor)} className={`h-5 w-5 rounded-full border ${editColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingNoteId(null)} className="text-xs text-white/50 hover:text-white">Cancel</button>
                                    <button onClick={saveNoteEdit} className="btn-primary px-3 py-1.5 text-[10px]">Save</button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="mt-3 text-sm leading-relaxed text-white/80">{note.text}</p>
                                {note.tags.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {note.tags.map((tag: string) => (
                                      <span key={tag} className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">#{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">Saved Moments</p>
                        <span className="text-[10px] uppercase font-bold text-white/40">{bookmarks?.length || 0} items</span>
                      </div>
                      {(bookmarks || []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                          <p className="text-xs text-white/40">Keep track of key chapters or difficult sections.</p>
                        </div>
                      ) : (
                        bookmarks?.map((bookmark) => (
                          <div key={bookmark.id} className="group relative flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-4 transition-all hover:bg-white/8">
                            <div className="flex items-center gap-4">
                              <button onClick={() => jumpToTime(bookmark.timeSeconds)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-[var(--accent)]">
                                <PlayCircle className="h-5 w-5" />
                              </button>
                              
                              {editingBookmarkId === bookmark.id ? (
                                <div className="flex-1 space-y-2 py-1">
                                  <input value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm" />
                                  <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                      {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                        <button key={`edit-bm-${name}`} onClick={() => setEditColor(name as AccentColor)} className={`h-4 w-4 rounded-full ${editColor === name ? "ring-1 ring-white" : ""}`} style={{ backgroundColor: value }} />
                                      ))}
                                    </div>
                                    <div className="flex gap-3 ml-auto">
                                      <button onClick={() => setEditingBookmarkId(null)} className="text-[10px] text-white/50">Cancel</button>
                                      <button onClick={saveBookmarkEdit} className="text-[10px] text-[var(--accent)] font-bold">Save</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-bold text-white group-hover:text-[var(--accent)] transition-colors">{bookmark.label}</p>
                                  <p className="mt-1 text-[10px] text-white/40">{formatTimestamp(bookmark.timeSeconds)} &bull; {bookmark.tags.join(", ") || "No tags"}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                              <button onClick={() => startEditingBookmark(bookmark)} className="p-1 text-white/50 hover:text-white"><Settings className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if(confirm("Delete bookmark?")) { deleteLectureBookmark(bookmark.id); mutateBookmarks(); } }} className="p-1 text-white/50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 md:p-6 overflow-hidden flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="rounded-2xl bg-white/5 p-3 text-white/80"><Search className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Smart Search</p>
                      <input 
                        type="text" 
                        placeholder="Jump to a topic via transcript..." 
                        className="mt-1 w-full bg-transparent text-lg font-bold text-white outline-none placeholder:text-white/20"
                        value={transcriptSearch}
                        onChange={(e) => setTranscriptSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {transcriptMatches.map((cue, idx) => (
                      <button 
                        key={`cue-${idx}`} 
                        onClick={() => jumpToTime(cue.start)}
                        className="w-full text-left rounded-xl border border-white/5 bg-black/20 p-4 transition-all hover:bg-white/5 hover:border-white/10 group"
                      >
                        <div className="flex justify-between items-start gap-4">
                           <p className="text-sm leading-relaxed text-white/70 group-hover:text-white transition-colors">{normalizeCueText(cue.text)}</p>
                           <span className="text-[10px] font-bold text-[var(--accent)] shrink-0">{formatTimestamp(cue.start)}</span>
                        </div>
                      </button>
                    ))}
                    {transcriptMatches.length === 0 && (
                      <div className="py-20 text-center">
                        <Search className="mx-auto h-8 w-8 text-white/10" />
                        <p className="mt-4 text-xs text-white/30">Matches will appear as you type.</p>
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute right-0 top-0 h-full w-[85%] max-w-[400px] border-l border-white/8 bg-[#0a0a0b] shadow-2xl animate-in slide-in-from-right duration-300">
               {sidebarContent}
            </aside>
          </div>
        )}

        {/* Desktop Sidebar - Course Rail */}
        {sidebarOpen && (
          <aside className="w-[380px] shrink-0 border-l border-white/8 bg-[#0a0a0b]/50 overflow-y-auto custom-scrollbar hidden xl:block">
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-bold text-white">Course Index</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Rail View</span>
      </div>

      <div className="space-y-6">
        {(course?.sections || []).map((section: SectionDTO) => {
          const isSectionExpanded = expandedSections.has(section.id) || section.id === currentSection?.id;
          return (
            <div key={section.id} className="space-y-2">
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
                <span className="text-xs font-bold text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-[0.1em]">{section.title}</span>
                {isSectionExpanded ? <ChevronDown className="h-4 w-4 text-white/20" /> : <ChevronRight className="h-4 w-4 text-white/20" />}
              </button>
              
              {isSectionExpanded && (
                <div className="space-y-1 pt-1 animate-in fade-in slide-in-from-top-1">
                  {section.lectures.map((lecture) => (
                    <Link 
                      key={lecture.id}
                      href={`/courses/${courseId}/watch/${lecture.id}`}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                        lecture.id === lectureId 
                          ? "bg-[var(--accent)]/15 border border-[var(--accent)]/20 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]" 
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        lecture.completed ? "bg-green-500/10 text-green-500" : "bg-white/5 text-white/30"
                      }`}>
                        {lecture.id === lectureId ? <PlayCircle className="h-4 w-4 text-[var(--accent)]" /> : <PlayCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold line-clamp-1 ${lecture.id === lectureId ? "text-white" : "text-white/60"}`}>{lecture.title}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{lecture.durationSeconds ? formatTimestamp(lecture.durationSeconds) : "--:--"}</p>
                      </div>
                      {lecture.id === lectureId && <Sparkles className="h-3 w-3 text-[var(--accent)]" />}
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
