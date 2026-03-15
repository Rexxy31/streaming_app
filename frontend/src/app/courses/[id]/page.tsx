"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Clock3, FileText, Heart, PlayCircle, Search, Sparkles, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  CourseDTO,
  LessonSearchResultDTO,
  StudyGuideDTO,
  fetchCourse,
  fetchFavoriteCourseIds,
  fetchStudyGuide,
  searchLessons,
  updateFavoriteCourse,
} from "@/lib/api";
import { formatDisplayTitle } from "@/lib/courseTitles";
import { formatTimestamp } from "@/lib/transcript";

type FavoriteCourseMap = Record<string, boolean>;

function formatMinutesLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [studyGuide, setStudyGuide] = useState<StudyGuideDTO | null>(null);
  const [favorites, setFavorites] = useState<FavoriteCourseMap>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [lessonResults, setLessonResults] = useState<LessonSearchResultDTO[]>([]);
  const [showUnwatchedOnly, setShowUnwatchedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const [courseData, favoriteIds, guide] = await Promise.all([
          fetchCourse(courseId),
          fetchFavoriteCourseIds(),
          fetchStudyGuide(courseId),
        ]);
        setCourse(courseData);
        setFavorites(Object.fromEntries(favoriteIds.map((id) => [id, true])));
        setStudyGuide(guide);
      } catch (error) {
        console.error("Failed to load course page", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, router]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setLessonResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      searchLessons(searchQuery, courseId)
        .then((result) => setLessonResults(result.lessons))
        .catch((error) => console.error("Course lesson search failed", error));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [courseId, searchQuery]);

  const filteredSections = useMemo(() => {
    if (!course?.sections) return [];
    return course.sections
      .map((section) => ({
        ...section,
        lectures: section.lectures.filter((lecture) => {
          const matchesSearch = searchQuery.trim().length < 2
            ? true
            : formatDisplayTitle(lecture.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
              lessonResults.some((result) => result.lectureId === lecture.id);
          const matchesState = showUnwatchedOnly ? !lecture.completed : true;
          return matchesSearch && matchesState;
        }),
      }))
      .filter((section) => section.lectures.length > 0);
  }, [course?.sections, lessonResults, searchQuery, showUnwatchedOnly]);

  const totalMinutes = Math.max(
    1,
    Math.round(
      (course?.sections?.reduce(
        (acc, section) => acc + section.lectures.reduce((lectureTotal, lecture) => lectureTotal + (lecture.durationSeconds || 8 * 60), 0),
        0
      ) || 0) / 60
    )
  );

  async function handleToggleFavorite() {
    const favoriteIds = await updateFavoriteCourse(courseId, !favorites[courseId]);
    setFavorites(Object.fromEntries(favoriteIds.map((id) => [id, true])));
  }

  function exportStudyGuide() {
    if (!studyGuide) return;
    const lines = [
      `Study Guide: ${formatDisplayTitle(studyGuide.courseTitle)}`,
      "",
      ...studyGuide.items.map((item) => {
        const tags = item.tags.length ? ` [${item.tags.join(", ")}]` : "";
        return `${item.type.toUpperCase()} ${formatTimestamp(item.timeSeconds)} · ${formatDisplayTitle(item.lectureTitle)}${tags}\n${item.primaryText}`;
      }),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${formatDisplayTitle(studyGuide.courseTitle)}-study-guide.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="content-container flex min-h-[70vh] items-center justify-center py-16">
        <div className="glass-card flex flex-col items-center gap-4 px-10 py-12 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Building course overview...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="content-container flex min-h-[70vh] items-center justify-center py-16">
        <div className="section-card px-10 py-12 text-center">
          <p className="text-lg font-semibold text-[var(--text)]">Course not found</p>
        </div>
      </div>
    );
  }

  const courseTitle = formatDisplayTitle(course.title);
  const firstLectureId = course.bestNextLectureId || course.sections?.[0]?.lectures?.[0]?.id || "";

  return (
    <div className="content-container py-8 md:py-10">
      <section className="hero-panel relative overflow-hidden px-6 py-8 text-white md:px-10 md:py-10">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to courses
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_0.95fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="pill-badge border-white/10 bg-white/10 text-white/75">
                  <Sparkles className="h-3.5 w-3.5" />
                  Course overview
                </div>
                <button onClick={handleToggleFavorite} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${favorites[courseId] ? "border-white/0 bg-white text-[#171717]" : "border-white/10 bg-white/8 text-white"}`}>
                  <Heart className={`h-4 w-4 ${favorites[courseId] ? "fill-current" : ""}`} />
                  {favorites[courseId] ? "Favorite" : "Save"}
                </button>
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-5xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>{courseTitle}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72">
                {course.description || "A structured collection of lessons and sections from your private library."}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="stat-chip min-w-[150px]">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Lectures</span>
                  <span className="text-3xl font-bold">{course.totalLectures}</span>
                </div>
                <div className="stat-chip min-w-[150px]">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Completed</span>
                  <span className="text-3xl font-bold">{course.completedLectures}</span>
                </div>
                <div className="stat-chip min-w-[150px]">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Estimated time</span>
                  <span className="text-3xl font-bold">{formatMinutesLabel(totalMinutes)}</span>
                </div>
              </div>
            </div>

            <div className="soft-panel p-6 text-[var(--text)]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Quick action</p>
              <h2 className="mt-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                {course.bestNextLectureTitle ? "Best next lesson" : "Start the first lesson"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {course.bestNextLectureTitle ? formatDisplayTitle(course.bestNextLectureTitle) : "Open this course and move through the content in order."}
              </p>
              <Link href={`/courses/${course.id}/watch/${firstLectureId}`} className="btn-primary mt-6 w-full px-6 py-4 text-sm">
                <PlayCircle className="h-4 w-4" />
                {course.bestNextLectureTitle ? "Continue lesson" : "Begin course"}
              </Link>

              <div className="mt-6 rounded-[22px] border border-black/8 bg-[var(--bg-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">Study guide</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{studyGuide?.totalNotes || 0} notes and {studyGuide?.totalBookmarks || 0} bookmarks ready to review.</p>
                <button onClick={exportStudyGuide} className="btn-secondary mt-4 w-full px-4 py-3 text-sm">
                  <FileText className="h-4 w-4" />
                  Export study guide
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_0.95fr]">
        <section className="space-y-6">
          <div className="section-card p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="theme-input-shell flex flex-1 items-center gap-3 rounded-full px-4 py-3">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input type="text" placeholder="Search lessons and transcript matches in this course" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
              </div>
              <button onClick={() => setShowUnwatchedOnly((value) => !value)} className={`rounded-full px-5 py-3 text-sm font-semibold ${showUnwatchedOnly ? "bg-[var(--text)] text-white" : "theme-input-shell text-[var(--text)]"}`}>
                {showUnwatchedOnly ? "Showing unwatched" : "Filter unwatched"}
              </button>
            </div>
          </div>

          {lessonResults.length > 0 ? (
            <div className="section-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Helpful results</p>
              <div className="mt-4 grid gap-3">
                {lessonResults.slice(0, 6).map((result) => (
                  <Link key={`${result.lectureId}-${result.sectionId}`} href={`/courses/${result.courseId}/watch/${result.lectureId}`} className="theme-outline-card rounded-[22px] p-4">
                    <p className="text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(result.lectureTitle)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDisplayTitle(result.sectionTitle)}</p>
                    {result.transcriptMatches[0] ? <p className="mt-2 text-xs text-[var(--text-muted)]">{result.transcriptMatches[0].text}</p> : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="section-card p-5">
            <div className="space-y-4">
              {filteredSections.map((section, sectionIndex) => (
                <div key={section.id} className="rounded-[22px] border border-black/8 bg-white/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Section {sectionIndex + 1}</p>
                      <h3 className="mt-2 text-lg font-bold text-[var(--text)]">{formatDisplayTitle(section.title)}</h3>
                    </div>
                    <span className="pill-badge"><BookOpen className="h-3.5 w-3.5" />{section.lectures.length} lessons</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {section.lectures.map((lecture) => (
                      <Link key={lecture.id} href={`/courses/${courseId}/watch/${lecture.id}`} className="theme-outline-card block rounded-[20px] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(lecture.title)}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {lecture.completed ? "Completed" : lecture.lastPositionSeconds > 0 ? "In progress" : "Not started"}
                              {lecture.hasSubtitle ? " · Transcript ready" : " · No transcript"}
                            </p>
                          </div>
                          {lecture.durationSeconds ? <span className="pill-badge">{formatDuration(lecture.durationSeconds)}</span> : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="soft-panel p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">At a glance</p>
            <div className="mt-4 space-y-4">
              <div className="metric-card p-4">
                <p className="text-sm text-[var(--text-muted)]">Course progress</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text)]">{course.progressPercentage}%</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-sm text-[var(--text-muted)]">Best next</p>
                <p className="mt-1 text-lg font-bold text-[var(--text)]">{course.bestNextLectureTitle ? formatDisplayTitle(course.bestNextLectureTitle) : "Start from lesson one"}</p>
              </div>
              <div className="metric-card p-4">
                <p className="text-sm text-[var(--text-muted)]">Study guide items</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text)]">{studyGuide?.items.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="soft-panel p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--accent-wash)] p-3 text-[var(--accent-strong)]">
                <Tags className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Study guide</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>Combined notes and bookmarks</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {studyGuide?.items.length ? studyGuide.items.slice(0, 8).map((item) => (
                <Link key={`${item.type}-${item.lectureId}-${item.createdAt}`} href={`/courses/${courseId}/watch/${item.lectureId}?t=${item.timeSeconds}`} className="theme-outline-soft block rounded-[22px] px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">{item.type}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">{item.primaryText}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDisplayTitle(item.lectureTitle)} · {formatTimestamp(item.timeSeconds)}</p>
                  {item.tags.length ? <p className="mt-2 text-xs text-[var(--text-muted)]">{item.tags.join(", ")}</p> : null}
                </Link>
              )) : (
                <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-sm text-[var(--text-muted)]">
                  Add notes and bookmarks while watching to build the study guide.
                </div>
              )}
            </div>
          </div>

          <div className="soft-panel p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Transcript coverage</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>Search readiness</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {course.sections?.flatMap((section) => section.lectures).slice(0, 6).map((lecture) => (
                <div key={lecture.id} className="theme-outline-soft rounded-[22px] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(lecture.title)}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{lecture.hasSubtitle ? "Transcript available for search" : "Transcript missing"}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
