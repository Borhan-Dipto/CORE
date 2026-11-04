import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="9" y="9" width="14" height="14" rx="3.5" className="fill-none stroke-primary-foreground" strokeWidth="2.4" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="1.2" className="fill-brand" />
    </svg>
  );
}

export function Logo({ href = "/", collapsed }: { href?: string; collapsed?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md outline-none" aria-label="CORE">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-[0.18em]">CORE</span>}
    </Link>
  );
}
