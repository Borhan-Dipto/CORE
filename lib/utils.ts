import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parses money/number input typed with English or Bangla digits (৳১,২৫০.৫০ → 1250.5). */
export function parseAmount(v: unknown): number {
  const ascii = String(v ?? "").replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  return Number(ascii.replace(/[^\d.]/g, "")) || 0;
}
