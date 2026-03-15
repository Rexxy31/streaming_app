"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  FileWarning,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  AdminHealthSummaryDTO,
  CourseDTO,
  SyncProgress,
  fetchCourse,
  fetchCourses,
  fetchCourseHealth,
  fetchScanStatus,
  refreshMetadata,
  scanS3,
} from "@/lib/api";

type User = { id: string; email: string; created_at: string; last_sign_in_at: string | null };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminDashboard() {
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [health, setHealth] = useState<AdminHealthSummaryDTO | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
    fetchHealth();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scanning || refreshing) {
      interval = setInterval(async () => {
        try {
          const status = await fetchScanStatus();
          setProgress(status);
          if (!status.active) {
            setScanning(false);
            setRefreshing(false);
            fetchHealth();
          }
        } catch (error) {
          console.error("Failed to fetch scan status", error);
        }
      }, 1000);
    } else {
      setProgress(null);
    }

    return () => clearInterval(interval);
  }, [refreshing, scanning]);

  async function fetchHealth() {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const summary = await fetchCourseHealth();
      if (summary.totalCourses > 0) {
        setHealth(summary);
        return;
      }

      const fallback = await buildSubtitleFallback();
      setHealth(fallback);
    } catch (error) {
      console.error("Failed to fetch health summary", error);
      try {
        const fallback = await buildSubtitleFallback();
        setHealth(fallback);
      } catch (fallbackError) {
        console.error("Fallback subtitle summary failed", fallbackError);
        setHealthError("Unable to load subtitle counts right now.");
      }
    } finally {
      setLoadingHealth(false);
    }
  }

  async function buildSubtitleFallback(): Promise<AdminHealthSummaryDTO> {
    const courses = await fetchCourses();
    const detailedCourses = await Promise.all(courses.map((course) => fetchCourse(course.id)));

    const courseSummaries = detailedCourses.map((course) => {
      const lectures = course.sections?.flatMap((section) => section.lectures) || [];
      const lecturesWithSubtitles = lectures.filter((lecture) => lecture.hasSubtitle).length;
      const missingSubtitleCount = lectures.length - lecturesWithSubtitles;

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalLectures: lectures.length,
        lecturesWithVideo: lectures.length,
        lecturesWithSubtitles,
        missingVideoCount: 0,
        missingSubtitleCount,
        status: missingSubtitleCount > 0 ? "missing-subtitles" : "healthy",
        lectureDiagnostics: [],
      };
    });

    return {
      totalCourses: detailedCourses.length,
      totalLectures: courseSummaries.reduce((sum, course) => sum + course.totalLectures, 0),
      totalMissingVideos: 0,
      totalMissingSubtitles: courseSummaries.reduce((sum, course) => sum + course.missingSubtitleCount, 0),
      courses: courseSummaries,
    };
  }

  async function fetchUsers() {
    try {
      setLoadingUsers(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setNotification(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");

      setNotification({ type: "success", message: `Account created. Temporary password: ${data.tempPassword}` });
      setInviteEmail("");
      fetchUsers();
    } catch (error: unknown) {
      setNotification({ type: "error", message: getErrorMessage(error, "Failed to invite user") });
    } finally {
      setInviting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  }

  async function handleScanS3() {
    setScanning(true);
    setNotification(null);
    try {
      await scanS3();
    } catch (error: unknown) {
      setNotification({ type: "error", message: getErrorMessage(error, "Failed to synchronize with S3.") });
      setScanning(false);
    }
  }

  async function handleRefreshMetadata() {
    setRefreshing(true);
    setNotification(null);
    try {
      await refreshMetadata();
    } catch (error: unknown) {
      setNotification({ type: "error", message: getErrorMessage(error, "Failed to refresh metadata.") });
      setRefreshing(false);
    }
  }

  function getSubtitleBadgeClass(missingSubtitleCount: number) {
    if (missingSubtitleCount === 0) {
      return "border border-emerald-300 bg-emerald-100 text-black dark:border-emerald-400/30 dark:bg-emerald-500/18 dark:text-emerald-100";
    }
    if (missingSubtitleCount < 10) {
      return "border border-amber-400 bg-amber-200 text-black dark:border-amber-400/35 dark:bg-amber-500/22 dark:text-amber-100";
    }
    if (missingSubtitleCount < 50) {
      return "border border-amber-500 bg-amber-300 text-black dark:border-amber-400/40 dark:bg-amber-500/26 dark:text-amber-50";
    }
    return "border border-orange-500 bg-orange-300 text-black dark:border-orange-400/40 dark:bg-orange-500/26 dark:text-orange-50";
  }

  return (
    <main className="content-container py-8 md:py-10">
      <section className="hero-panel overflow-hidden px-6 py-8 text-white md:px-10 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div>
            <div className="pill-badge border-white/10 bg-white/10 text-white/74">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin control center
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              Manage learner access, sync the catalog, and diagnose missing media from one place.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Subtitle status, missing-video checks, and per-course health diagnostics now sit alongside import and user-management tools.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Users</span>
              <span className="text-3xl font-bold">{users.length}</span>
              <span className="text-sm text-white/65">Accounts with access</span>
            </div>
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Missing videos</span>
              <span className="text-3xl font-bold">{health?.totalMissingVideos ?? 0}</span>
              <span className="text-sm text-white/65">Across the whole catalog</span>
            </div>
            <div className="stat-chip">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Missing subtitles</span>
              <span className="text-3xl font-bold">{health?.totalMissingSubtitles ?? 0}</span>
              <span className="text-sm text-white/65">Lessons not transcript-ready</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="space-y-6">
          <div className="section-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--accent-wash)] p-3 text-[var(--accent-strong)]">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Content sync</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  S3 operations
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Run a full course import or probe missing video durations to keep the learning catalog current.
            </p>

            {progress && progress.active ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 overflow-hidden rounded-[22px] border border-black/8 bg-[var(--bg-muted)] p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-[var(--text)]">{progress.status}</span>
                  <span className="font-bold text-[var(--accent-strong)]">{progress.percentage}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress.percentage}%` }} className="h-full rounded-full bg-[var(--accent)]" />
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{progress.current} of {progress.total} items processed</p>
              </motion.div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={handleScanS3} disabled={scanning || refreshing} className="btn-primary w-full px-6 py-4 text-sm disabled:opacity-60">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {scanning ? "Scanning S3..." : "Run deep scan"}
              </button>
              <button onClick={handleRefreshMetadata} disabled={scanning || refreshing} className="btn-secondary w-full px-6 py-4 text-sm disabled:opacity-60">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                {refreshing ? "Refreshing durations..." : "Populate missing durations"}
              </button>
            </div>
          </div>

          <div className="section-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Access control</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  Provision a user
                </h2>
              </div>
            </div>

            <form onSubmit={handleInviteUser} className="mt-5 space-y-4">
              <div className="flex items-center gap-3 rounded-[20px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(23,20,18,0.06)]">
                <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                <input type="email" required placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
              </div>
              <button type="submit" disabled={inviting || !inviteEmail} className="btn-primary w-full px-6 py-4 text-sm disabled:opacity-60">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {inviting ? "Creating account..." : "Create account"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="section-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Subtitle health</p>
                <h2 className="mt-1 text-3xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  Missing subtitles
                </h2>
              </div>
              <div className="pill-badge">
                <FileWarning className="h-3.5 w-3.5" />
                {health?.totalCourses ?? 0} courses
              </div>
            </div>

            {loadingHealth ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-[var(--border)] px-5 py-5 text-sm text-[var(--text-muted)]">
                Loading subtitle counts...
              </div>
            ) : healthError ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-[var(--border)] px-5 py-5 text-sm text-[var(--danger)]">
                {healthError}
              </div>
            ) : (
            <div className="mt-6 space-y-3">
              {(health?.courses || []).map((course) => (
                <div key={course.courseId} className="rounded-[24px] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-strong)_88%,transparent)] px-5 py-5 shadow-[var(--card-shadow)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--text)]">{course.courseTitle}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{course.totalLectures} lessons · {course.lecturesWithSubtitles} subtitle-ready</p>
                    </div>
                    <div className={`rounded-full px-4 py-2 text-sm font-semibold ${getSubtitleBadgeClass(course.missingSubtitleCount)}`}>
                      {course.missingSubtitleCount} missing subtitles
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="section-card p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Directory</p>
                <h2 className="mt-1 text-3xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  Learner accounts
                </h2>
              </div>
              <div className="pill-badge">
                <Users className="h-3.5 w-3.5" />
                {users.length} registered
              </div>
            </div>

            {loadingUsers ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-strong)]" />
                <p className="text-sm font-semibold">Loading user registry...</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex flex-col gap-4 rounded-[24px] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-strong)_88%,transparent)] px-5 py-5 shadow-[var(--card-shadow)] md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-dark-soft)] text-sm font-bold text-white ring-1 ring-[var(--border-strong)]">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{user.email}</p>
                        <p className="text-xs text-[var(--text-muted)]">{user.id.split("-")[0]}...</p>
                      </div>
                    </div>
                    <div className="grid gap-3 text-sm text-[var(--text-muted)] sm:grid-cols-2 md:min-w-[320px]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Joined</p>
                        <p className="mt-1 text-[var(--text)]">{new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Last sign in</p>
                        <p className="mt-1 text-[var(--text)]">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {notification ? (
          <motion.div initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }} className={`fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-[24px] px-5 py-4 shadow-[0_25px_60px_rgba(23,20,18,0.18)] ${notification.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {notification.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />}
            <p className="text-sm font-semibold leading-6">{notification.message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
