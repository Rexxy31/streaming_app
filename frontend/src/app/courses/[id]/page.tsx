"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock3, FileText, Heart, PlayCircle, Search, Sparkles, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase";
import ServerSleepInfo from "@/components/ServerSleepInfo";
import {
  fetchCourse,
  fetchFavoriteCourseIds,
  fetchStudyGuide,
  searchLessons,
  updateFavoriteCourse,
} from "@/lib/api";
import useSWR, { mutate as globalMutate } from "swr";
import { formatDisplayTitle } from "@/lib/courseTitles";
import { formatTimestamp } from "@/lib/transcript";



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

  // SWR Hooks
  const { data: course, error: courseError } = useSWR(`course-${courseId}`, () => fetchCourse(courseId));
  const { data: favoriteIds, mutate: mutateFavorites } = useSWR("favorites", fetchFavoriteCourseIds);
  const { data: studyGuide } = useSWR(`study-guide-${courseId}`, () => fetchStudyGuide(courseId));

  const [searchQuery, setSearchQuery] = useState("");
  const [showUnwatchedOnly, setShowUnwatchedOnly] = useState(false);

  // Derive favorites local map for easy lookup
  const favorites = useMemo(() => {
    const ids = favoriteIds || [];
    return Object.fromEntries(ids.map((id) => [id, true]));
  }, [favoriteIds]);

  // Auth check remains in useEffect
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

  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResult } = useSWR(
    debouncedQuery.trim().length >= 2 ? `course-${courseId}-search-${debouncedQuery}` : null,
    () => searchLessons(debouncedQuery, courseId)
  );

  const lessonResults = useMemo(() => searchResult?.lessons || [], [searchResult]);

  const filteredSections = useMemo(() => {
    if (!course?.sections) return [];
    
    // Use the actual sections array as dependency basis
    const sections = course.sections;

    return sections
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
  }, [course, lessonResults, searchQuery, showUnwatchedOnly]);

  const totalMinutes = Math.max(
    1,
    (course?.sections || []).reduce(
      (acc, s) => acc + s.lectures.reduce((lAcc, l) => lAcc + (l.durationSeconds || 0), 0),
      0
    ) / 60
  );

  async function handleToggleFavorite() {
    await updateFavoriteCourse(courseId, !favorites[courseId]);
    mutateFavorites();
    globalMutate("dashboard");
  }

  if (loading) {
    return (
      <div className="content-container py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-[var(--text-muted)]">Loading course intelligence...</p>
        </div>
      </div>
    );
  }

  if (courseError) {
    return (
      <div className="content-container py-20 text-center">
        <h2 className="text-2xl font-bold text-[var(--text)]">Course not found</h2>
        <p className="mt-2 text-[var(--text-muted)]">The course you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href="/" className="btn-primary mt-8 inline-flex px-8 py-3">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <main className="content-container py-8 md:py-12">
      <Link href="/" className="btn-secondary mb-8 inline-flex w-fit items-center gap-2 border-none bg-transparent px-0 text-[var(--text-muted)] hover:bg-transparent hover:text-[var(--text)]">
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <section>
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="pill-badge border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)]">
                    <Sparkles className="h-3 w-3" />
                    Premium Content
                  </div>
                  <div className="text-xs font-medium text-[var(--text-muted)]">
                    {course?.totalLectures} Lessons &bull; {Math.round(totalMinutes)} mins
                  </div>
                </div>
                <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-[var(--text)] md:text-5xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  {formatDisplayTitle(course?.title || "") || "Course Details"}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-[var(--text-muted)]">
                  {course?.description || "Master these concepts with our lesson-level search and integrated transcripts."}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={handleToggleFavorite}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                    favorites[courseId]
                      ? "border-red-500/20 bg-red-500/10 text-red-500"
                      : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${favorites[courseId] ? "fill-current" : ""}`} />
                </button>
                {course?.bestNextLectureId ? (
                  <Link
                    href={`/courses/${courseId}/watch/${course.bestNextLectureId}`}
                    className="btn-primary h-12 px-6"
                  >
                    <PlayCircle className="h-5 w-5" />
                    {course.completedLectures === 0 ? "Start Learning" : "Continue"}
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
               <h3 className="text-xl font-bold text-[var(--text)]">Curriculum</h3>
               <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Find a topic..."
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm transition-all focus:border-[var(--accent)] sm:w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setShowUnwatchedOnly(!showUnwatchedOnly)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                      showUnwatchedOnly
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {showUnwatchedOnly ? "Showing Unwatched" : "Hide Completed"}
                  </button>
               </div>
            </div>

            <div className="space-y-6">
              {filteredSections.map((section) => (
                <div key={section.id} className="glass-card overflow-hidden bg-[var(--surface)]">
                  <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-6 py-4">
                    <h4 className="font-bold text-[var(--text)]">{section.title}</h4>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {section.lectures.map((lecture) => (
                      <Link
                        key={lecture.id}
                        href={`/courses/${courseId}/watch/${lecture.id}`}
                        className="group flex items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--accent)]/5"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                            lecture.completed
                              ? "bg-green-500/10 text-green-500"
                              : "bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)]"
                          }`}>
                            <PlayCircle className="h-5 w-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-medium text-[var(--text)] line-clamp-1 group-hover:text-[var(--accent)] transition-colors">
                              {lecture.title}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                              <span>{formatDuration(lecture.durationSeconds)}</span>
                              {lecture.hasSubtitle && (
                                <span className="flex items-center gap-1 rounded bg-[var(--border)] px-1 py-0.5 text-[8px] font-bold">
                                  CC
                                </span>
                              )}
                              {lecture.completed && (
                                <span className="text-green-500 font-bold">Completed</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowLeft className="h-4 w-4 rotate-180 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {filteredSections.length === 0 && (
                <div className="glass-card flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-[var(--text-muted)]/30" />
                  <p className="mt-4 text-[var(--text-muted)]">No lessons match your current filters.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="glass-card surface-grid bg-[var(--surface)] p-8">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text)]">
              <Sparkles className="h-5 w-5 text-[var(--accent)]" />
              Course Progress
            </h3>
            <div className="mt-6 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-[var(--text)]">{Math.round(course?.progressPercentage || 0)}%</p>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Overall completion</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--text)]">{course?.completedLectures} / {course?.totalLectures}</p>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Lessons done</p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700 ease-out"
                  style={{ width: `${course?.progressPercentage || 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card bg-[var(--surface)] p-8">
             <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text)]">
              <Tags className="h-5 w-5 text-[var(--accent)]" />
              Study Guide
            </h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Quick access to your {studyGuide?.totalNotes || 0} notes and {studyGuide?.totalBookmarks || 0} bookmarks for this course.
            </p>

            <div className="mt-6 space-y-4">
              {studyGuide?.items.slice(0, 5).map((item, idx) => (
                <Link
                  key={`${item.type}-${idx}`}
                  href={`/courses/${courseId}/watch/${item.lectureId}?time=${item.timeSeconds}`}
                  className="block group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                      item.type === "note" ? "border-blue-500/20 bg-blue-500/10 text-blue-500" : "border-orange-500/20 bg-orange-500/10 text-orange-400"
                    }`}>
                      {item.type === "note" ? <FileText className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-[var(--text)] line-clamp-1 group-hover:text-[var(--accent)]">{item.primaryText}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        {item.lectureTitle} @ {formatTimestamp(item.timeSeconds)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {(!studyGuide?.items || studyGuide.items.length === 0) && (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-xs text-[var(--text-muted)]">Your personal guide is empty. Start taking notes while watching!</p>
                </div>
              )}

              {(studyGuide?.items || []).length > 5 && (
                <button className="text-xs font-bold text-[var(--accent)] hover:underline">
                  View all study materials ({studyGuide?.items.length})
                </button>
              )}
            </div>
          </div>

          <ServerSleepInfo className="border-none bg-transparent p-0" />
        </aside>
      </div>
    </main>
  );
}
