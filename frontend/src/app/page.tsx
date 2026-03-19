"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Heart,
  PlayCircle,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  fetchDashboard,
  searchLessons,
  updateFavoriteCourse,
} from "@/lib/api";
import useSWR, { mutate as globalMutate } from "swr";
import { formatDisplayTitle } from "@/lib/courseTitles";

function getCourseCover(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("java")) return "#9a3412";
  if (normalized.includes("python")) return "#1d4ed8";
  if (normalized.includes("react")) return "#0f766e";
  if (normalized.includes("node")) return "#166534";
  if (normalized.includes("css")) return "#2563eb";
  if (normalized.includes("postgres")) return "#5b3cc4";
  return "#3f1d73";
}

function formatCatalogDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function truncateSnippet(text: string) {
  return text.length > 96 ? `${text.slice(0, 96).trim()}...` : text;
}



export default function Dashboard() {
  const { data: dashboard, error, mutate } = useSWR("dashboard", fetchDashboard);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Derive favoriteCourses map when dashboard data changes to avoid cascading renders
  const favoriteCourses = useMemo(() => {
    const ids = dashboard?.favoriteCourseIds || [];
    return Object.fromEntries(ids.map((id) => [id, true]));
  }, [dashboard?.favoriteCourseIds]);

  const courses = useMemo(() => dashboard?.courses || [], [dashboard?.courses]);

  const continueLearning = dashboard?.continueLearning || null;
  const loading = !dashboard && !error;

  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResult } = useSWR(
    debouncedQuery.trim().length >= 2 ? `search-${debouncedQuery}` : null,
    () => searchLessons(debouncedQuery)
  );

  const lessonResults = useMemo(() => searchResult?.lessons.slice(0, 6) || [], [searchResult]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const formattedTitle = formatDisplayTitle(course.title).toLowerCase();
      const inSearch = formattedTitle.includes(searchQuery.toLowerCase());
      const inFavorites = showFavoritesOnly ? Boolean(favoriteCourses[course.id]) : true;
      return inSearch && inFavorites;
    });
  }, [courses, favoriteCourses, searchQuery, showFavoritesOnly]);

  const completedCourses = courses.filter((course) => course.progressPercentage === 100).length;
  const inProgressCourses = courses.filter((course) => course.progressPercentage > 0 && course.progressPercentage < 100).length;
  const totalMinutes = courses.reduce((total, course) => total + course.totalLectures * 8, 0);

  async function handleToggleFavorite(courseId: string) {
    await updateFavoriteCourse(courseId, !favoriteCourses[courseId]);
    // Trigger global revalidation for other pages and local revalidation for dashboard data
    mutate();
    globalMutate("favorites");
  }

  if (loading) {
    return (
      <div className="content-container flex min-h-[70vh] items-center justify-center py-16">
        <div className="glass-card flex flex-col items-center gap-4 px-10 py-12 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <div>
            <p className="text-lg font-bold text-[var(--text)]">Loading your learning space</p>
            <p className="text-sm text-[var(--text-muted)]">Pulling in courses, transcript search, and next steps.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="content-container py-8 md:py-10">
      <section className="hero-panel surface-grid relative overflow-hidden px-6 py-8 text-white md:px-10 md:py-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="max-w-3xl">
            <div className="pill-badge mb-5 border-white/10 bg-white/10 text-white/78">
              <Sparkles className="h-3.5 w-3.5" />
              Smarter streaming classroom
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              Continue better, search deeper, and move through your library with less friction.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
              Lesson-level discovery now surfaces matching lectures and transcript hits, while continue-learning cards help you pick up where you left off or finish what is almost done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {continueLearning?.pickUpWhereYouLeftOff ? (
                <Link href={`/courses/${continueLearning.pickUpWhereYouLeftOff.courseId}/watch/${continueLearning.pickUpWhereYouLeftOff.lectureId}`} className="btn-primary px-6 py-4 text-sm">
                  <PlayCircle className="h-4 w-4" />
                  Resume best next lesson
                </Link>
              ) : null}
              <Link href="#library" className="btn-secondary border-white/10 bg-white/10 px-6 py-4 text-sm text-white hover:bg-white/16 hover:text-white">
                <BookOpen className="h-4 w-4" />
                Browse lesson library
              </Link>
            </div>
          </div>

          <div className="relative hidden flex-col justify-center lg:flex">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{completedCourses}</p>
                    <p className="text-xs uppercase tracking-wider text-white/56">Completed</p>
                  </div>
                </div>
              </div>
              <div className="glass-card border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{formatCatalogDuration(totalMinutes)}</p>
                    <p className="text-xs uppercase tracking-wider text-white/56">Learning Time</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-[var(--accent)]/10 p-5 backdrop-blur-md">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm font-medium text-white/90">
                {inProgressCourses} courses currently in progress
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-[-10%] top-[-100%] h-[200%] w-[50%] animate-pulse rounded-full bg-[var(--accent)]/15 blur-[120px]" />
      </section>

      <section id="library" className="mt-16">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              Lesson Library
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">Dive into your enrolled courses or discover new topics.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search transcripts or titles..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-10 pr-4 text-sm transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 sm:w-80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {lessonResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl backdrop-blur-xl">
                  <div className="mb-2 px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Transcript & Title Hits
                  </div>
                  {lessonResults.map((lesson) => (
                    <Link
                      key={lesson.lectureId}
                      href={`/courses/${lesson.courseId}/watch/${lesson.lectureId}`}
                      className="group block rounded-xl px-3 py-3 hover:bg-[var(--accent)]/5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent)]">{lesson.lectureTitle}</p>
                        {lesson.matchedInTitle && <Sparkles className="h-3 w-3 text-[var(--accent)]" />}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{lesson.courseTitle}</p>
                      {lesson.transcriptMatches.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {lesson.transcriptMatches.map((hit, idx) => (
                            <span key={`${lesson.lectureId}-hit-${idx}`} className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)] group-hover:border-[var(--accent)]/20 group-hover:bg-[var(--accent)]/10">
                              &quot;{truncateSnippet(hit.text)}&quot;
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                showFavoritesOnly
                  ? "bg-red-500/10 text-red-500"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)]"
              }`}
            >
              <Heart className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              {showFavoritesOnly ? "Favorites Only" : "Show All"}
            </button>
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-[var(--text-muted)]/30" />
            <h3 className="mt-4 text-lg font-bold text-[var(--text)]">No results found</h3>
            <p className="mt-1 text-[var(--text-muted)]">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((course) => (
              <div key={course.id} className="course-card glass-card group flex flex-col border-none bg-[var(--surface)] hover:z-10">
                <div
                  className="relative aspect-video w-full"
                  style={{ backgroundColor: getCourseCover(course.title) }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-sm font-bold text-white line-clamp-2">{formatDisplayTitle(course.title)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggleFavorite(course.id);
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-white hover:text-red-500"
                  >
                    <Heart className={`h-4 w-4 ${favoriteCourses[course.id] ? "fill-current text-red-500" : ""}`} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{course.totalLectures} lessons</span>
                    </div>
                    {course.progressPercentage > 0 && (
                      <div className="flex items-center gap-1.5 text-[var(--accent)] font-medium">
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>{Math.round(course.progressPercentage)}% done</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex items-center gap-3">
                    <Link
                      href={`/courses/${course.id}`}
                      className="btn-secondary flex-1 py-3 text-xs"
                    >
                      View Details
                    </Link>
                    <Link
                      href={course.bestNextLectureId ? `/courses/${course.id}/watch/${course.bestNextLectureId}` : `/courses/${course.id}`}
                      className="btn-primary flex h-10 w-10 items-center justify-center p-0"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {course.progressPercentage > 0 && (
                  <div className="absolute bottom-0 left-0 h-1 bg-[var(--accent)]/30" style={{ width: "100%" }}>
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${course.progressPercentage}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
