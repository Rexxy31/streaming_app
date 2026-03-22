"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const doc = document as any;
    if (!doc.startViewTransition) {
      // Fallback for browsers that don't support View Transitions
      document.documentElement.classList.add("theme-transition");
      toggleTheme();
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 500);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      // We call toggleTheme synchronously here. The API takes a snapshot before, and a snapshot after.
      toggleTheme();
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 1000,
          easing: "ease-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );

      // Water ripple effect mimicking the user's CSS codepen reference
      const createRipple = (delay: number, duration: number, isDarkRing: boolean) => {
        const wave = document.createElement("div");
        wave.style.position = "fixed";
        wave.style.left = `${x}px`;
        wave.style.top = `${y}px`;
        wave.style.transform = "translate(-50%, -50%)";
        wave.style.borderRadius = "50%";
        wave.style.zIndex = "2147483647"; // Above the view transition
        wave.style.pointerEvents = "none";
        
        // Match the specific colors from the codepen:
        // White inner glow, and dark outer shadow rings
        const ringColor = isDarkRing ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.4)";
        const blurLevel = isDarkRing ? "5px" : "10px";
        
        // We use borders and shadows to represent the expanding shadow layers
        wave.style.border = `2px solid ${ringColor}`;
        wave.style.boxShadow = `0 0 ${blurLevel} ${ringColor}`;
        document.body.appendChild(wave);

        // The codepen expands the dark shadow slightly further/faster than the white shadow 
        // to create concentric separation.
        const multiplier = isDarkRing ? 2.3 : 2.1;

        const animation = wave.animate(
          [
            { width: "0px", height: "0px", opacity: 1 },
            { width: `${endRadius * multiplier}px`, height: `${endRadius * multiplier}px`, opacity: 0 },
          ],
          {
            duration: duration,
            delay: delay,
            easing: "ease-out",
          }
        );

        animation.onfinish = () => wave.remove();
      };

      // Create cascading water ripples directly matching the codepen's concentric styling
      createRipple(0, 1200, false); // White ring
      createRipple(0, 1400, true);  // Dark ring spreading wider
      createRipple(200, 1200, false); // Delayed white ring
      createRipple(200, 1400, true);  // Delayed dark ring
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
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
