"use client";

import React from "react";
import { Info } from "lucide-react";

interface ServerSleepInfoProps {
  className?: string;
}

export default function ServerSleepInfo({ className = "" }: ServerSleepInfoProps) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 ${className}`}>
      <div className="mt-0.5 rounded-lg bg-[var(--accent-wash)] p-1.5 text-[var(--accent-soft-strong)]">
        <Info className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-soft-strong)]">
          Free Tier Hosting Info
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/52">
          Since we use a free server, actions like <span className="text-white/80 font-medium">Next Lesson</span> or <span className="text-white/80 font-medium">Saving Notes</span> might take ~30s if the server is waking up. Thanks for your patience!
        </p>
      </div>
    </div>
  );
}
