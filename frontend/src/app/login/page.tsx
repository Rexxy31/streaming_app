"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Lock, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/");
    });
  }, [router, supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--body-bg)] px-4 py-10 text-[var(--text)] theme-transition">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-[rgba(164,53,240,0.3)] blur-3xl opacity-60 dark:opacity-100" />
        <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-[rgba(245,158,11,0.18)] blur-3xl opacity-60 dark:opacity-100" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.9fr]">
        <section className="glass-card flex flex-col justify-center rounded-[32px] border border-[var(--border)] bg-[var(--surface-strong)] p-8 md:p-10 shadow-[var(--shadow-card)]">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-muted)] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            <BookOpen className="h-3.5 w-3.5" />
            Private learning hub
          </div>
          <h1
            className="mt-6 max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-[var(--text)] md:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            A cleaner, premium way to stream your course library.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--text-muted)] font-medium">
            Sign in to continue your lessons, track progress, and navigate a modern course experience built for focus.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="glass-card rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[var(--text)]">Focused playback</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Immersive player with quick lesson navigation.</p>
            </div>
            <div className="glass-card rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[var(--text)]">Structured library</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Course cards, progress summaries, and resume state.</p>
            </div>
            <div className="glass-card rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[var(--text)]">Private access</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Restricted sign-in for invited users only.</p>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-[32px] border border-[var(--border-strong)] bg-[var(--surface-strong)] p-8 shadow-[var(--shadow-card)] md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-wash)] text-[var(--accent-strong)] dark:text-[var(--accent)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">Welcome back</p>
              <h2
                className="mt-1 text-3xl font-extrabold text-[var(--text)] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Sign in
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text-muted)]">Email</span>
              <div className="flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] focus-within:border-[var(--accent)] transition-all">
                <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 font-medium"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text-muted)]">Password</span>
              <div className="flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] focus-within:border-[var(--accent)] transition-all">
                <Lock className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 font-medium"
                  placeholder="Enter your password"
                />
              </div>
            </label>

            {error ? (
              <p className={`text-sm font-semibold px-2 ${error.includes("Check your email") ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full px-6 py-4 text-sm disabled:opacity-60 shadow-[0_8px_24px_var(--accent-wash)] hover:shadow-[0_12px_32px_var(--accent-wash)]">
              {loading ? "Signing you in..." : "Enter workspace"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-semibold uppercase tracking-[0.1EM] text-[var(--text-muted)]">
            This environment is private and intended for invited learners only.
          </p>
        </section>
      </div>
    </div>
  );
}
