import type { Metadata } from "next";
import "./globals.css";
import ClientNav from "@/components/ClientNav";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "StreamApp | Premium Course Library",
  description: "A modern private learning workspace for streaming, tracking, and revisiting courses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased"
        style={{
          fontFamily: '"Aptos", "Segoe UI", "Helvetica Neue", sans-serif',
        }}
      >
        <ThemeProvider>
          <ClientNav>{children}</ClientNav>
        </ThemeProvider>
      </body>
    </html>
  );
}
