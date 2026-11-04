"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((i) => {
        const active = i.href.split("/").length === 3 ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
