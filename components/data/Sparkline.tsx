"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Small smooth area line for trends inside cards and the hero (no axes, purely visual). */
export function Sparkline({ values, className, color = "var(--chart-1)", strokeWidth = 1.75, fillOpacity = 0.28 }: {
  values: number[]; className?: string; color?: string; strokeWidth?: number; fillOpacity?: number;
}) {
  const id = `spark-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pts = values.length > 1 ? values : values.length === 1 ? [values[0], values[0]] : [0, 0];
  const W = 300, H = 100, pad = 6;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, pad + (1 - (v - min) / span) * (H - pad * 2)] as const);
  // Catmull-Rom → cubic Bézier for a calm, smooth line
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const flat = max === min;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className={cn("block w-full overflow-visible", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={flat ? fillOpacity / 3 : fillOpacity} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={flat ? 0.45 : 1} />
    </svg>
  );
}
