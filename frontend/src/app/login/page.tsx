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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1b1322] px-4 py-10 text-white">
      <div className="absolute inset-0">
        <div className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-[rgba(164,53,240,0.3)] blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-[rgba(245,158,11,0.18)] blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.9fr]">
        <section className="flex flex-col justify-center rounded-[32px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl md:p-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/72">
            <BookOpen className="h-3.5 w-3.5" />
            Private learning hub
          </div>
          <h1
            className="mt-6 max-w-xl text-4xl font-bold leading-tight md:text-6xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            A cleaner, premium way to stream your course library.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            Sign in to continue your lessons, track progress, and navigate a modern course experience built for focus.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold">Focused playback</p>
              <p className="mt-2 text-sm leading-6 text-white/60">Immersive player with quick lesson navigation.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold">Structured library</p>
              <p className="mt-2 text-sm leading-6 text-white/60">Course cards, progress summaries, and resume state.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold">Private access</p>
              <p className="mt-2 text-sm leading-6 text-white/60">Restricted sign-in for invited users only.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white p-8 text-black shadow-[0_30px_100px_rgba(0,0,0,0.35)] md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#a435f0]/10 text-[#7f27bf]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7f27bf]">Welcome back</p>
              <h2
                className="mt-1 text-3xl font-bold !text-black"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Sign in
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 text-black">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Email</span>
              <div className="flex items-center gap-3 rounded-[20px] border border-black/10 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(23,20,18,0.06)]">
                <Mail className="h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm !text-black outline-none placeholder:text-slate-400"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-600">Password</span>
              <div className="flex items-center gap-3 rounded-[20px] border border-black/10 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(23,20,18,0.06)]">
                <Lock className="h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm !text-black outline-none placeholder:text-slate-400"
                  placeholder="Enter your password"
                />
              </div>
            </label>

            {error ? (
              <p className={`text-sm font-medium ${error.includes("Check your email") ? "text-emerald-600" : "text-red-600"}`}>
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full px-6 py-4 text-sm disabled:opacity-60">
              {loading ? "Signing you in..." : "Enter workspace"}
            </button>
          </form>

          <p className="mt-6 text-sm leading-6 text-[var(--text-muted)]">
            This environment is private and intended for invited learners only.
          </p>
        </section>
      </div>
    </div>
  );
}
