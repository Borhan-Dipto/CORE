"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const id = `core-brass-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecd39a" /><stop offset="0.55" stopColor="#c9a25c" /><stop offset="1" stopColor="#8f6c2e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#10141b" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke={`url(#${id})`} strokeOpacity="0.55" />
      <rect x="9" y="9" width="14" height="14" rx="3.5" fill="none" stroke={`url(#${id})`} strokeWidth="2.4" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="1.2" fill={`url(#${id})`} />
    </svg>
  );
}

export function Logo({ href = "/", collapsed }: { href?: string; collapsed?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md outline-none" aria-label="CORE">
      <LogoMark />
      {!collapsed && <span className="font-display text-[19px] font-semibold tracking-[0.14em]">CORE</span>}
    </Link>
  );
}
