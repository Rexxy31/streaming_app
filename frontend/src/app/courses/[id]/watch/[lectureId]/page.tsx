"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Tags,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  CourseDTO,
  LectureBookmarkDTO,
  LectureDTO,
  LectureNoteDTO,
  SectionDTO,
  createLectureBookmark,
  createLectureNote,
  deleteLectureBookmark,
  deleteLectureNote,
  fetchCourse,
  fetchLectureBookmarks,
  fetchLectureNotes,
  fetchLectureSubtitle,
  fetchStreamUrl,
  updateLectureBookmark,
  updateLectureDuration,
  updateLectureNote,
  updateProgress,
} from "@/lib/api";
import { formatDisplayTitle } from "@/lib/courseTitles";
import { formatTimestamp, normalizeCueText, parseSubtitleText } from "@/lib/transcript";
import VideoPlayer from "@/components/VideoPlayer";

type SidebarFilter = "all" | "in-progress" | "unwatched" | "completed";
type AccentColor = "gold" | "mint" | "sky" | "orchid" | "rose";

const NOTE_COLORS: Record<AccentColor, string> = {
  gold: "#f59e0b",
  mint: "#10b981",
  sky: "#3b82f6",
  orchid: "#a855f7",
  rose: "#f43f5e",
};

function formatMinutes(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function parseTagDraft(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function truncateText(text: string, max = 40) {
  return text.length <= max ? text : `${text.slice(0, max).trim()}...`;
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = params.id as string;
  const lectureId = params.lectureId as string;
  const latestProgressRef = useRef({ time: 0, completed: false });
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [subtitleText, setSubtitleText] = useState<string | null>(null);
  const [currentLecture, setCurrentLecture] = useState<LectureDTO | null>(null);
  const [currentSection, setCurrentSection] = useState<SectionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [allLectures, setAllLectures] = useState<{ lecture: LectureDTO; section: SectionDTO }[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [contentSearch, setContentSearch] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("all");
  const [notes, setNotes] = useState<LectureNoteDTO[]>([]);
  const [bookmarks, setBookmarks] = useState<LectureBookmarkDTO[]>([]);
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

  const transcriptCues = useMemo(() => parseSubtitleText(subtitleText), [subtitleText]);
  const transcriptMatches = useMemo(() => {
    if (!transcriptSearch.trim()) return transcriptCues;
    return transcriptCues.filter((cue) => normalizeCueText(cue.text).toLowerCase().includes(transcriptSearch.toLowerCase()));
  }, [transcriptCues, transcriptSearch]);

  const chapterMarkers = useMemo(() => {
    const cueChapters = transcriptCues
      .filter((cue, index) => index === 0 || cue.start - transcriptCues[index - 1].start >= 180)
      .slice(0, 8)
      .map((cue) => ({
        timeSeconds: Math.floor(cue.start),
        label: truncateText(normalizeCueText(cue.text), 28),
      }));

    const noteChapters = notes.slice(0, 4).map((note) => ({
      timeSeconds: note.timeSeconds,
      label: truncateText(note.text, 24),
    }));

    const bookmarkChapters = bookmarks.slice(0, 4).map((bookmark) => ({
      timeSeconds: bookmark.timeSeconds,
      label: truncateText(bookmark.label, 24),
    }));

    return [{ timeSeconds: 0, label: "Start" }, ...cueChapters, ...noteChapters, ...bookmarkChapters]
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .filter((chapter, index, arr) => index === 0 || arr[index - 1].timeSeconds !== chapter.timeSeconds)
      .slice(0, 10);
  }, [bookmarks, notes, transcriptCues]);

  useEffect(() => {
    checkAuthAndLoad();
  }, [courseId, lectureId]);

  useEffect(() => {
    Promise.all([fetchLectureNotes(lectureId), fetchLectureBookmarks(lectureId)])
      .then(([noteData, bookmarkData]) => {
        setNotes(noteData);
        setBookmarks(bookmarkData);
      })
      .catch((err) => console.error("Failed to load notes/bookmarks:", err));
    setNoteDraft("");
    setNoteTagDraft("");
    setBookmarkTagDraft("");
    setAutoAdvanceSeconds(null);
    setEditingNoteId(null);
    setEditingBookmarkId(null);
    setSeekToSeconds(searchParams.get("t") ? Number(searchParams.get("t")) : null);
  }, [lectureId, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const checkAuthAndLoad = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    try {
      const [courseData, urlData, subtitleData] = await Promise.all([
        fetchCourse(courseId),
        fetchStreamUrl(lectureId),
        fetchLectureSubtitle(lectureId),
      ]);

      setCourse(courseData);
      setStreamUrl(urlData.url);
      setSubtitleText(subtitleData);

      const flat: { lecture: LectureDTO; section: SectionDTO }[] = [];

      courseData.sections?.forEach((section) => {
        section.lectures.forEach((lecture) => {
          flat.push({ lecture, section });
        });
      });

      const currentItem = flat.find((item) => item.lecture.id === lectureId) ?? null;
      const foundLecture = currentItem?.lecture ?? null;
      const foundSection = currentItem?.section ?? null;

      setCurrentLecture(foundLecture);
      setCurrentSection(foundSection);
      setAllLectures(flat);
      if (foundSection) {
        setExpandedSections(new Set([foundSection.id]));
      }
    } catch (err) {
      console.error("Failed to load watch page:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProgress = useCallback((time: number, duration: number, isCompleted: boolean) => {
    latestProgressRef.current = { time, completed: isCompleted };
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
    if (autoAdvanceSeconds === null) return;
    if (autoAdvanceSeconds <= 0) {
      const idx = allLectures.findIndex((item) => item.lecture.id === lectureId);
      if (idx >= 0 && idx < allLectures.length - 1) {
        router.push(`/courses/${courseId}/watch/${allLectures[idx + 1].lecture.id}`);
      }
      return;
    }

    const timeout = window.setTimeout(
      () => setAutoAdvanceSeconds((seconds) => (seconds === null ? null : seconds - 1)),
      1000
    );
    return () => window.clearTimeout(timeout);
  }, [allLectures, autoAdvanceSeconds, courseId, lectureId, router]);

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

  const copyTimestampLink = async (seconds: number) => {
    const url = `${window.location.origin}/courses/${courseId}/watch/${lectureId}?t=${Math.max(0, Math.floor(seconds))}`;
    await navigator.clipboard.writeText(url);
    setToast("Timestamp link copied");
  };

  const handleVideoEnded = () => {
    const { time } = latestProgressRef.current;
    updateProgress(lectureId, Math.floor(time || 0), true).catch(console.error);
    const idx = allLectures.findIndex((item) => item.lecture.id === lectureId);
    if (idx >= 0 && idx < allLectures.length - 1) setAutoAdvanceSeconds(5);
  };

  const addBookmark = () => {
    const timeSeconds = Math.floor(latestProgressRef.current.time || currentLecture?.lastPositionSeconds || 0);
    createLectureBookmark(lectureId, {
      timeSeconds,
      label: `Moment at ${formatTimestamp(timeSeconds)}`,
      tags: parseTagDraft(bookmarkTagDraft),
      highlightColor: bookmarkColor,
    })
      .then((bookmark) => {
        setBookmarks((current) => [bookmark, ...current]);
        setBookmarkTagDraft("");
        setToast("Bookmark saved");
      })
      .catch((err) => console.error("Failed to create bookmark:", err));
  };

  const addNote = () => {
    if (!noteDraft.trim()) return;
    const timeSeconds = Math.floor(latestProgressRef.current.time || currentLecture?.lastPositionSeconds || 0);
    createLectureNote(lectureId, {
      timeSeconds,
      text: noteDraft.trim(),
      tags: parseTagDraft(noteTagDraft),
      highlightColor: highlightColor,
    })
      .then((note) => {
        setNotes((current) => [note, ...current]);
        setNoteDraft("");
        setNoteTagDraft("");
        setToast("Note saved");
      })
      .catch((err) => console.error("Failed to create note:", err));
  };

  const startEditingNote = (note: LectureNoteDTO) => {
    setEditingNoteId(note.id);
    setEditingBookmarkId(null);
    setEditDraft(note.text);
    setEditTagDraft(note.tags.join(", "));
    setEditColor((note.highlightColor as AccentColor) || "orchid");
  };

  const startEditingBookmark = (bookmark: LectureBookmarkDTO) => {
    setEditingBookmarkId(bookmark.id);
    setEditingNoteId(null);
    setEditDraft(bookmark.label);
    setEditTagDraft(bookmark.tags.join(", "));
    setEditColor((bookmark.highlightColor as AccentColor) || "gold");
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditingBookmarkId(null);
    setEditDraft("");
    setEditTagDraft("");
  };

  const saveEditedNote = (note: LectureNoteDTO) => {
    updateLectureNote(note.id, {
      timeSeconds: note.timeSeconds,
      text: editDraft.trim(),
      tags: parseTagDraft(editTagDraft),
      highlightColor: editColor,
    })
      .then((updated) => {
        setNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        cancelEditing();
        setToast("Note updated");
      })
      .catch((err) => console.error("Failed to update note:", err));
  };

  const saveEditedBookmark = (bookmark: LectureBookmarkDTO) => {
    updateLectureBookmark(bookmark.id, {
      timeSeconds: bookmark.timeSeconds,
      label: editDraft.trim(),
      tags: parseTagDraft(editTagDraft),
      highlightColor: editColor,
    })
      .then((updated) => {
        setBookmarks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        cancelEditing();
        setToast("Bookmark updated");
      })
      .catch((err) => console.error("Failed to update bookmark:", err));
  };

  const removeNote = (noteId: string) => {
    deleteLectureNote(noteId)
      .then(() => {
        setNotes((current) => current.filter((item) => item.id !== noteId));
        setToast("Note deleted");
      })
      .catch((err) => console.error("Failed to delete note:", err));
  };

  const removeBookmark = (bookmarkId: string) => {
    deleteLectureBookmark(bookmarkId)
      .then(() => {
        setBookmarks((current) => current.filter((item) => item.id !== bookmarkId));
        setToast("Bookmark deleted");
      })
      .catch((err) => console.error("Failed to delete bookmark:", err));
  };

  const currentIndex = allLectures.findIndex((item) => item.lecture.id === lectureId);
  const previousLecture = currentIndex > 0 ? allLectures[currentIndex - 1] : null;
  const nextLecture = currentIndex >= 0 && currentIndex < allLectures.length - 1 ? allLectures[currentIndex + 1] : null;
  const courseTitle = formatDisplayTitle(course?.title);
  const currentLectureTitle = formatDisplayTitle(currentLecture?.title);
  const currentSectionTitle = formatDisplayTitle(currentSection?.title);

  const filteredSections = useMemo(() => {
    if (!course?.sections) return [];
    return course.sections
      .map((section) => ({
        ...section,
        lectures: section.lectures.filter((lecture) => {
          const searchMatch = formatDisplayTitle(lecture.title).toLowerCase().includes(contentSearch.toLowerCase());
          const filterMatch =
            sidebarFilter === "all"
              ? true
              : sidebarFilter === "completed"
                ? lecture.completed
                : sidebarFilter === "in-progress"
                  ? lecture.lastPositionSeconds > 0 && !lecture.completed
                  : !lecture.completed;
          return searchMatch && filterMatch;
        }),
      }))
      .filter((section) => section.lectures.length > 0 || contentSearch.length === 0);
  }, [contentSearch, course?.sections, sidebarFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[var(--surface-dark)] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm text-white/68">Loading immersive player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="watch-page min-h-dvh bg-[var(--surface-dark)] text-white">
      <div className="mx-auto flex min-h-dvh max-w-[1680px] flex-col px-2 py-2 sm:px-3 lg:px-4">
        <div className="dark-panel flex min-h-[calc(100dvh-1rem)] overflow-hidden rounded-[28px]">
          <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-dark)]">
            <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={`/courses/${courseId}`} className="rounded-full border border-white/10 p-2 text-white/72 hover:bg-white/8 hover:text-white">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Now learning</p>
                  <h1 className="truncate text-sm font-semibold text-white md:text-base">{courseTitle}</h1>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/72 hover:bg-white/6"
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                Content
              </button>
            </nav>

            <div className="flex-1 overflow-x-hidden overflow-y-auto">
              <div className={`grid min-w-0 gap-6 px-3 py-3 md:px-6 md:py-6 ${sidebarOpen ? "xl:grid-cols-[minmax(0,1.5fr)_360px]" : ""}`}>
                <div className="min-w-0">
                  <div className="relative aspect-video w-full overflow-hidden rounded-[24px] border border-white/8 bg-black">
                    {streamUrl ? (
                      <VideoPlayer
                        src={streamUrl}
                        subtitleText={subtitleText}
                        title={currentLectureTitle}
                        autoPlay
                        initialTime={seekToSeconds ?? currentLecture?.lastPositionSeconds ?? 0}
                        seekToSeconds={seekToSeconds}
                        chapters={chapterMarkers}
                        onCopyTimestampLink={copyTimestampLink}
                        onProgress={handleProgress}
                        onEnded={handleVideoEnded}
                        onDurationLoaded={(duration) => {
                          if (currentLecture && (!currentLecture.durationSeconds || currentLecture.durationSeconds === 0)) {
                            updateLectureDuration(lectureId, Math.floor(duration));
                          }
                        }}
                      />
                    ) : null}
                    {autoAdvanceSeconds !== null && nextLecture ? (
                      <div className="absolute bottom-5 right-5 max-w-sm rounded-[24px] border border-white/10 bg-[#171717]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft-strong)]">Up next</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{formatDisplayTitle(nextLecture.lecture.title)}</h3>
                        <p className="mt-1 text-sm text-white/58">Advancing automatically in {autoAdvanceSeconds}s</p>
                        <div className="mt-4 flex gap-3">
                          <button onClick={() => setAutoAdvanceSeconds(null)} className="btn-secondary border-white/10 bg-white/8 px-4 py-3 text-xs text-white hover:bg-white/12 hover:text-white">Stay here</button>
                          <Link href={`/courses/${courseId}/watch/${nextLecture.lecture.id}`} className="btn-primary px-4 py-3 text-xs">Watch next</Link>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-[28px] border border-white/8 bg-white/[0.04] p-5 md:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill-badge border-white/10 bg-white/8 text-white/68"><BookOpen className="h-3.5 w-3.5" />{currentSectionTitle || "Current section"}</span>
                      <span className="pill-badge border-white/10 bg-white/8 text-white/68">{currentLecture?.durationSeconds ? formatMinutes(currentLecture.durationSeconds) : "Duration pending"}</span>
                      <span className="pill-badge border-white/10 bg-white/8 text-white/68">{currentLecture?.hasSubtitle ? "Transcript ready" : "Transcript unavailable"}</span>
                    </div>
                    <h2 className="mt-5 text-3xl font-bold leading-tight md:text-4xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>{currentLectureTitle}</h2>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button onClick={addBookmark} className="btn-secondary border-white/10 bg-white/8 px-5 py-3 text-sm text-white hover:bg-white/12 hover:text-white"><Bookmark className="h-4 w-4" />Add bookmark</button>
                      <button onClick={() => copyTimestampLink(Math.floor(latestProgressRef.current.time || 0))} className="btn-secondary border-white/10 bg-white/8 px-5 py-3 text-sm text-white hover:bg-white/12 hover:text-white"><Copy className="h-4 w-4" />Copy current timestamp</button>
                      {previousLecture ? <Link href={`/courses/${courseId}/watch/${previousLecture.lecture.id}`} className="btn-secondary border-white/10 bg-white/8 px-5 py-3 text-sm text-white hover:bg-white/12 hover:text-white"><ChevronLeft className="h-4 w-4" />Previous</Link> : null}
                      {nextLecture ? <Link href={`/courses/${courseId}/watch/${nextLecture.lecture.id}`} className="btn-primary px-5 py-3 text-sm">Next lesson<ChevronRight className="h-4 w-4" /></Link> : null}
                    </div>
                  </div>

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
                          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Capture a takeaway from this exact moment..." className="min-h-[132px] w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
                          <div className="mt-4 grid gap-3">
                            <input value={noteTagDraft} onChange={(event) => setNoteTagDraft(event.target.value)} placeholder="Tags: exam, api, revisit" className="rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35" />
                            <div className="flex flex-wrap items-center gap-2">
                              {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                <button key={name} type="button" onClick={() => setHighlightColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${highlightColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-white/56">Linked to {formatTimestamp(Math.floor(latestProgressRef.current.time || currentLecture?.lastPositionSeconds || 0))}</p>
                            <button onClick={addNote} className="btn-primary px-4 py-3 text-xs">Save note</button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                          <p className="text-sm font-semibold text-white">Quick bookmark</p>
                          <p className="mt-2 text-sm leading-6 text-white/52">Drop a timestamp marker with a tag set and color, then revisit it from your study guide or chapter rail.</p>
                          <div className="mt-4 grid gap-3">
                            <input value={bookmarkTagDraft} onChange={(event) => setBookmarkTagDraft(event.target.value)} placeholder="Tags: recap, example" className="rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35" />
                            <div className="flex flex-wrap items-center gap-2">
                              {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                <button key={`bookmark-${name}`} type="button" onClick={() => setBookmarkColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${bookmarkColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">Current position</p>
                            <p className="mt-1 text-lg font-semibold text-white">{formatTimestamp(Math.floor(latestProgressRef.current.time || currentLecture?.lastPositionSeconds || 0))}</p>
                          </div>
                          <button onClick={addBookmark} className="btn-secondary mt-4 w-full border-white/10 bg-white/8 px-4 py-3 text-sm text-white hover:bg-white/12">Save current timestamp</button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/56">Saved notes</p>
                            <p className="text-xs text-white/52">{notes.length} total</p>
                          </div>
                          {notes.length === 0 ? <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">No notes yet. Add one while you watch to build your study guide.</div> : notes.map((note) => (
                            <div key={note.id} className="rounded-[22px] border border-white/8 bg-black/20 px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <button onClick={() => jumpToTime(note.timeSeconds)} className="text-left text-xs uppercase tracking-[0.18em] text-[var(--accent-soft-strong)] hover:text-white">{formatTimestamp(note.timeSeconds)}</button>
                                <div className="flex gap-2 text-xs">
                                  <button onClick={() => startEditingNote(note)} className="text-white/50 hover:text-white">Edit</button>
                                  <button onClick={() => removeNote(note.id)} className="text-white/50 hover:text-red-300">Delete</button>
                                </div>
                              </div>
                              {editingNoteId === note.id ? (
                                <div className="mt-3 space-y-3">
                                  <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} className="min-h-[90px] w-full resize-none rounded-[16px] border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" />
                                  <input value={editTagDraft} onChange={(event) => setEditTagDraft(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none" />
                                  <div className="flex flex-wrap items-center gap-2">
                                    {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                      <button key={`edit-note-${name}`} type="button" onClick={() => setEditColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${editColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => saveEditedNote(note)} className="btn-primary px-4 py-2 text-xs">Save</button>
                                    <button onClick={cancelEditing} className="btn-secondary border-white/10 bg-white/8 px-4 py-2 text-xs text-white hover:bg-white/12">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="mt-3 text-sm leading-6 text-white/82">{note.text}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {note.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/62"><Tags className="h-3 w-3" />{tag}</span>)}
                                    {note.highlightColor ? <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/62"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NOTE_COLORS[(note.highlightColor as AccentColor) || "orchid"] }} />{note.highlightColor}</span> : null}
                                  </div>
                                </>
                              )}
                            </div>
                          ))}</div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/56">Saved bookmarks</p>
                            <p className="text-xs text-white/52">{bookmarks.length} total</p>
                          </div>
                          {bookmarks.length === 0 ? <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">Save timestamps to create quick chapter markers and review anchors.</div> : bookmarks.map((bookmark) => (
                            <div key={bookmark.id} className="rounded-[22px] border border-white/8 bg-black/20 px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <button onClick={() => jumpToTime(bookmark.timeSeconds)} className="text-left">
                                  <p className="text-sm font-semibold text-white hover:text-[var(--accent-soft-strong)]">{bookmark.label}</p>
                                  <p className="mt-1 text-xs text-white/45">{formatTimestamp(bookmark.timeSeconds)}</p>
                                </button>
                                <div className="flex gap-2 text-xs">
                                  <button onClick={() => startEditingBookmark(bookmark)} className="text-white/50 hover:text-white">Edit</button>
                                  <button onClick={() => removeBookmark(bookmark.id)} className="text-white/50 hover:text-red-300">Delete</button>
                                </div>
                              </div>
                              {editingBookmarkId === bookmark.id ? (
                                <div className="mt-3 space-y-3">
                                  <input value={editDraft} onChange={(event) => setEditDraft(event.target.value)} className="w-full rounded-[16px] border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" />
                                  <input value={editTagDraft} onChange={(event) => setEditTagDraft(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none" />
                                  <div className="flex flex-wrap items-center gap-2">
                                    {Object.entries(NOTE_COLORS).map(([name, value]) => (
                                      <button key={`edit-bookmark-${name}`} type="button" onClick={() => setEditColor(name as AccentColor)} className={`h-7 w-7 rounded-full border-2 ${editColor === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => saveEditedBookmark(bookmark)} className="btn-primary px-4 py-2 text-xs">Save</button>
                                    <button onClick={cancelEditing} className="btn-secondary border-white/10 bg-white/8 px-4 py-2 text-xs text-white hover:bg-white/12">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {bookmark.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/62"><Tags className="h-3 w-3" />{tag}</span>)}
                                  {bookmark.highlightColor ? <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/62"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NOTE_COLORS[(bookmark.highlightColor as AccentColor) || "gold"] }} />{bookmark.highlightColor}</span> : null}
                                </div>
                              )}
                            </div>
                          ))}</div>
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 md:p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-sky-500/18 p-3 text-sky-300"><FileText className="h-5 w-5" /></div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Transcript</p>
                          <h3 className="mt-1 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display), sans-serif" }}>Searchable transcript panel</h3>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3">
                        <Search className="h-4 w-4 text-white/40" />
                        <input value={transcriptSearch} onChange={(event) => setTranscriptSearch(event.target.value)} placeholder="Search this transcript" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/32" />
                      </div>
                      <div className="mt-5 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                        {transcriptMatches.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                            {subtitleText ? "No transcript lines match that search yet." : "This lesson does not have a subtitle transcript yet."}
                          </div>
                        ) : transcriptMatches.map((cue) => (
                          <div key={`${cue.start}-${cue.end}`} className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <button onClick={() => jumpToTime(Math.floor(cue.start))} className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 hover:text-white">
                                {formatTimestamp(cue.start)}
                              </button>
                              <button onClick={() => copyTimestampLink(Math.floor(cue.start))} className="text-xs text-white/68 hover:text-white">Copy link</button>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/82">{normalizeCueText(cue.text)}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {sidebarOpen ? (
                  <aside className="flex flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[#161616] shadow-[0_28px_80px_rgba(0,0,0,0.28)] xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]">
                    <div className="border-b border-white/8 bg-white/[0.03] px-5 py-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent-soft-strong)]">Course content</p>
                      <h2 className="mt-2 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display), sans-serif" }}>{courseTitle}</h2>
                      <p className="mt-2 text-sm text-white/52">{course?.completedLectures || 0}/{course?.totalLectures || 0} lessons completed</p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3">
                          <Search className="h-4 w-4 text-white/40" />
                          <input type="text" placeholder="Search lessons" value={contentSearch} onChange={(event) => setContentSearch(event.target.value)} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/32" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(["all", "in-progress", "unwatched", "completed"] as SidebarFilter[]).map((filter) => (
                            <button key={filter} onClick={() => setSidebarFilter(filter)} className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] ${sidebarFilter === filter ? "bg-white text-[#171717]" : "border border-white/8 bg-white/[0.04] text-white/58"}`}>
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
                      {filteredSections.map((section, sectionIndex) => {
                        const isExpanded = expandedSections.has(section.id);
                        return (
                          <div key={section.id} className={`mb-3 overflow-hidden rounded-[24px] border ${currentSection?.id === section.id ? "border-[var(--accent)]/40 bg-[#24182e]" : "border-white/6 bg-white/[0.03]"}`}>
                            <button onClick={() => setExpandedSections((prev) => {
                              const next = new Set(prev);
                              if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                              return next;
                            })} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Section {sectionIndex + 1}</span>
                                  {currentSection?.id === section.id ? <span className="rounded-full bg-[var(--accent)]/18 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-soft-strong)]">Watching</span> : null}
                                </div>
                                <h3 className="mt-3 text-sm font-semibold leading-6 text-white">{formatDisplayTitle(section.title)}</h3>
                              </div>
                              {isExpanded ? <ChevronRight className="h-4 w-4 rotate-90 text-white/45" /> : <ChevronRight className="h-4 w-4 text-white/45" />}
                            </button>
                            {isExpanded ? (
                              <div className="border-t border-white/6 px-2 pb-2 pt-2">
                                {section.lectures.map((lecture, lectureIndex) => {
                                  const isCurrent = lecture.id === lectureId;
                                  const isStarted = lecture.lastPositionSeconds > 0 && !lecture.completed;
                                  return (
                                    <Link key={lecture.id} href={`/courses/${courseId}/watch/${lecture.id}`} className={`mt-2 flex items-start gap-3 rounded-[20px] border px-3 py-3 ${isCurrent ? "border-white bg-white text-[#171717]" : "border-transparent text-white hover:border-white/6 hover:bg-white/[0.05]"}`}>
                                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${isCurrent ? "bg-[#171717] text-white" : lecture.completed ? "bg-emerald-500/20 text-emerald-300" : isStarted ? "bg-[var(--accent)]/20 text-[var(--accent-soft-strong)]" : "bg-white/8 text-white/70"}`}>
                                        {lectureIndex + 1}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold leading-6 ${isCurrent ? "text-[#171717]" : "text-white"}`}>{formatDisplayTitle(lecture.title)}</p>
                                        <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${isCurrent ? "text-[#171717]/70" : "text-white/45"}`}>
                                          <span>{lecture.durationSeconds ? formatMinutes(lecture.durationSeconds) : "Pending duration"}</span>
                                          <span>{lecture.hasSubtitle ? "Transcript" : "No transcript"}</span>
                                        </div>
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#171717]/95 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">{toast}</div> : null}
    </div>
  );
}
