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
  ContinueLearningDTO,
  CourseDTO,
  LessonSearchResultDTO,
  RecentLectureDTO,
  fetchContinueLearning,
  fetchCourses,
  fetchFavoriteCourseIds,
  fetchRecentLectures,
  searchLessons,
  updateFavoriteCourse,
} from "@/lib/api";
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

type FavoriteCourseMap = Record<string, boolean>;

export default function Dashboard() {
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [recentLectures, setRecentLectures] = useState<RecentLectureDTO[]>([]);
  const [continueLearning, setContinueLearning] = useState<ContinueLearningDTO | null>(null);
  const [favoriteCourses, setFavoriteCourses] = useState<FavoriteCourseMap>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [lessonResults, setLessonResults] = useState<LessonSearchResultDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [coursesData, recentData, favoriteIds, continueData] = await Promise.all([
          fetchCourses(),
          fetchRecentLectures(),
          fetchFavoriteCourseIds(),
          fetchContinueLearning(),
        ]);
        setCourses(coursesData);
        setRecentLectures(recentData);
        setFavoriteCourses(Object.fromEntries(favoriteIds.map((id) => [id, true])));
        setContinueLearning(continueData);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setLessonResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      searchLessons(searchQuery)
        .then((result) => setLessonResults(result.lessons.slice(0, 6)))
        .catch((error) => console.error("Lesson search failed", error));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

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
    const favoriteIds = await updateFavoriteCourse(courseId, !favoriteCourses[courseId]);
    setFavoriteCourses(Object.fromEntries(favoriteIds.map((id) => [id, true])));
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
                View all courses
              </Link>
            </div>
          </div>

          <div className="grid gap-4 self-start md:grid-cols-2 lg:grid-cols-1">
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Courses</span>
              <span className="text-3xl font-bold">{courses.length}</span>
              <span className="text-sm text-white/78">Private catalog</span>
            </div>
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">In progress</span>
              <span className="text-3xl font-bold">{inProgressCourses}</span>
              <span className="text-sm text-white/78">Active courses with momentum</span>
            </div>
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Completed</span>
              <span className="text-3xl font-bold">{completedCourses}</span>
              <span className="text-sm text-white/78">Finished end-to-end</span>
            </div>
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/72">Catalog time</span>
              <span className="text-3xl font-bold">{formatCatalogDuration(totalMinutes)}</span>
              <span className="text-sm text-white/78">Available in your library</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="section-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Continue-learning intelligence</p>
              <h2 className="mt-2 text-3xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                {continueLearning?.pickUpWhereYouLeftOff ? formatDisplayTitle(continueLearning.pickUpWhereYouLeftOff.lectureTitle) : "Choose your next lesson"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {continueLearning?.pickUpWhereYouLeftOff
                  ? `${formatDisplayTitle(continueLearning.pickUpWhereYouLeftOff.courseTitle)} · ${continueLearning.pickUpWhereYouLeftOff.progressPercentage}% watched`
                  : "As soon as you start learning, the next best action will show up here."}
              </p>
            </div>
            {continueLearning?.pickUpWhereYouLeftOff ? (
              <Link href={`/courses/${continueLearning.pickUpWhereYouLeftOff.courseId}/watch/${continueLearning.pickUpWhereYouLeftOff.lectureId}`} className="btn-primary px-6 py-4 text-sm">
                Jump back in
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {continueLearning?.pickUpWhereYouLeftOff ? (
              <Link href={`/courses/${continueLearning.pickUpWhereYouLeftOff.courseId}/watch/${continueLearning.pickUpWhereYouLeftOff.lectureId}`} className="theme-outline-card rounded-[22px] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Pick up where you left off</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(continueLearning.pickUpWhereYouLeftOff.lectureTitle)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDisplayTitle(continueLearning.pickUpWhereYouLeftOff.courseTitle)}</p>
              </Link>
            ) : null}
            {continueLearning?.almostFinished ? (
              <Link href={`/courses/${continueLearning.almostFinished.courseId}/watch/${continueLearning.almostFinished.lectureId}`} className="theme-outline-card rounded-[22px] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Almost finished</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(continueLearning.almostFinished.lectureTitle)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{continueLearning.almostFinished.progressPercentage}% complete</p>
              </Link>
            ) : null}
            {(continueLearning?.bestNextLessons || []).slice(0, 1).map((item) => (
              <Link key={item.lectureId} href={`/courses/${item.courseId}/watch/${item.lectureId}`} className="theme-outline-card rounded-[22px] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Best next lesson</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(item.lectureTitle)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDisplayTitle(item.courseTitle)}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Recent activity</p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                Continue from history
              </h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {recentLectures.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-6 text-sm text-[var(--text-muted)]">
                Your viewing history will appear here once you start watching.
              </div>
            ) : recentLectures.slice(0, 4).map((lecture) => (
              <Link key={lecture.lectureId} href={`/courses/${lecture.courseId}/watch/${lecture.lectureId}`} className="theme-outline-card flex items-center justify-between rounded-[22px] px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(lecture.lectureTitle)}</p>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{formatDisplayTitle(lecture.courseTitle)} · {lecture.progressPercentage}% watched</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="library" className="mt-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent-strong)]">Library</p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--text)] md:text-4xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>Courses and lessons</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Search now reaches into lesson titles and transcript snippets, not just course names.</p>
          </div>

          <div className="flex w-full flex-col gap-3 md:max-w-md">
            <div className="theme-input-shell flex items-center gap-3 rounded-full px-4 py-3">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input type="text" placeholder="Search courses, lessons, and transcripts" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
            </div>
            <button onClick={() => setShowFavoritesOnly((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${showFavoritesOnly ? "bg-[var(--text)] text-white" : "theme-input-shell text-[var(--text)]"}`}>
              <Heart className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              {showFavoritesOnly ? "Showing favorites" : "Filter favorites"}
            </button>
          </div>
        </div>

        {lessonResults.length > 0 ? (
          <div className="section-card mt-6 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Helpful search results</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lessonResults.map((result) => (
                <Link key={`${result.lectureId}-${result.sectionId}`} href={`/courses/${result.courseId}/watch/${result.lectureId}`} className="theme-outline-card rounded-[22px] p-4">
                  <p className="text-sm font-semibold text-[var(--text)]">{formatDisplayTitle(result.lectureTitle)}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDisplayTitle(result.courseTitle)} · {formatDisplayTitle(result.sectionTitle)}</p>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    {result.matchedInTranscript && result.transcriptMatches[0] ? truncateSnippet(result.transcriptMatches[0].text) : "Matched lesson title"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course) => {
            const courseTitle = formatDisplayTitle(course.title);
            const isFavorite = Boolean(favoriteCourses[course.id]);
            return (
              <article key={course.id} className="section-card h-full overflow-hidden">
                <div className="relative overflow-hidden px-6 py-7 text-white" style={{ background: getCourseCover(course.title) }}>
                  <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="max-w-[80%]">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/58">Course</p>
                      <h3 className="mt-3 text-2xl font-bold leading-tight text-white/95" style={{ fontFamily: "var(--font-display), sans-serif" }}>{courseTitle}</h3>
                    </div>
                    <button onClick={() => handleToggleFavorite(course.id)} className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${isFavorite ? "border-white/0 bg-white text-[#171717]" : "border-white/10 bg-white/10 text-white"}`} aria-label={isFavorite ? "Remove favorite" : "Add favorite"}>
                      <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="pill-badge"><BookOpen className="h-3.5 w-3.5" />{course.totalLectures} lessons</span>
                    {course.almostFinished ? <span className="pill-badge"><Trophy className="h-3.5 w-3.5" />Almost finished</span> : null}
                  </div>
                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-[var(--text)]">Progress</span>
                      <span className="font-bold text-[var(--accent-strong)]">{course.progressPercentage}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${course.progressPercentage}%` }} />
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-[var(--text-muted)]">{course.bestNextLectureTitle ? `Best next: ${formatDisplayTitle(course.bestNextLectureTitle)}` : "Open course"}</p>
                    <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
