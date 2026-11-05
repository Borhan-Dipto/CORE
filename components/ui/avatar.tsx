import { cn } from "@/lib/utils";

const PALETTE = ["#a8843f", "#4f6d93", "#3f8f72", "#b5683f", "#6f5a9c", "#5b6573", "#2f7f86", "#8e4256"];

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
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white ring-1 ring-white/10", square ? "rounded-md" : "rounded-full", s, className)}
      style={{ background: colorFor(seed ?? name) }}>
      {initials(name)}
    </span>
  );
}
