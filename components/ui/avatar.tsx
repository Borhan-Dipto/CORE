import { cn } from "@/lib/utils";

const PALETTE = ["#3b82f6", "#16a34a", "#d97706", "#8b5cf6", "#0ea5e9", "#db2777", "#0f766e", "#64748b"];

export function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function initials(name: string) {
  const parts = name.replace(/@.*/, "").trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Initials avatar with a stable colour per name (no external images). */
export function Avatar({ name, seed, size = "md", square, className }: { name: string; seed?: string; size?: "sm" | "md" | "lg"; square?: boolean; className?: string }) {
  const s = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" }[size];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white", square ? "rounded-md" : "rounded-full", s, className)}
      style={{ background: colorFor(seed ?? name) }}>
      {initials(name)}
    </span>
  );
}
