"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BookOpen, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";

export default function ClientNav({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email?: string; avatar_url?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const email = session.user.email;
    setUser({
      email,
      avatar_url: session.user.user_metadata?.avatar_url,
    });
    setIsAdmin(email === process.env.NEXT_PUBLIC_ADMIN_EMAIL);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkAuth();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [checkAuth, pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLinks = [
    { name: "Library", href: "/", icon: LayoutGrid },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <nav className="theme-nav sticky top-0 z-50 backdrop-blur-xl">
        <div className="content-container flex min-h-[76px] items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_14px_28px_rgba(164,53,240,0.22)]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p
                  className="text-lg font-bold leading-none tracking-tight text-[var(--text)]"
                  style={{ fontFamily: "var(--font-display), sans-serif" }}
                >
                  StreamApp
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  Learning library
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 lg:flex">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive
                        ? "theme-nav-link-active"
                        : "theme-nav-link"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="theme-nav-user flex items-center gap-3 rounded-full px-2 py-2">
              {user?.avatar_url ? (
                <Image src={user.avatar_url} alt="User Avatar" width={40} height={40} className="rounded-full object-cover" unoptimized />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent-strong)]">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              <div className="hidden min-w-0 pr-1 sm:block">
                <p className="max-w-[160px] truncate text-sm font-semibold leading-none text-[var(--text)]">
                  {user?.email?.split("@")[0] || "Learner"}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isAdmin ? "Admin" : "Member"}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="btn-ghost rounded-full px-3 py-3 text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
