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

/** Opens a dialog once when the URL has ?new=<key> (used by the mobile quick-add menu), then cleans the URL. */
export function consumeNewParam(key: string | undefined): boolean {
  if (!key || typeof window === "undefined") return false;
  const u = new URL(window.location.href);
  if (u.searchParams.get("new") !== key) return false;
  u.searchParams.delete("new");
  window.history.replaceState(window.history.state, "", u.pathname + (u.search ? u.search : "") + u.hash);
  return true;
}
