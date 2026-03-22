import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import ClientNav from "@/components/ClientNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import SWRConfigContext from "@/components/SWRConfigContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | StreamApp",
    default: "StreamApp | Premium Course Library",
  },
  description: "A modern private learning workspace for streaming, tracking, and revisiting premium courses.",
  keywords: ["streaming", "courses", "learning", "education", "development"],
  authors: [{ name: "StreamApp Team" }],
  creator: "StreamApp",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://streamapp.example.com",
    siteName: "StreamApp",
    title: "StreamApp | Premium Course Library",
    description: "A modern private learning workspace for streaming, tracking, and revisiting premium courses.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "StreamApp Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StreamApp | Premium Course Library",
    description: "A modern private learning workspace for streaming, tracking, and revisiting premium courses.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StreamApp",
  },
};

export const viewport = {
  themeColor: "#8b5cf6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-[var(--body-bg)] text-[var(--text)] antialiased font-sans transition-colors duration-300">
        <ThemeProvider>
          <SWRConfigContext>
            <ClientNav>{children}</ClientNav>
          </SWRConfigContext>
        </ThemeProvider>
      </body>
    </html>
  );
}
