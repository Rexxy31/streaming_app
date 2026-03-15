"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle inline-flex items-center gap-3 rounded-full px-2 py-2 text-sm font-semibold"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Theme
      </span>
      <span className={`theme-switch ${isDark ? "theme-switch-dark" : ""}`} aria-hidden="true">
        <span className={`theme-switch-thumb ${isDark ? "theme-switch-thumb-dark" : ""}`}>
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </span>
      </span>
    </button>
  );
}
