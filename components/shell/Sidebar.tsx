"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shell/Logo";
import { Tooltip } from "@/components/ui/overlay";
import type { NavSection } from "@/components/shell/nav";

export function isActive(path: string, href: string, exact?: boolean) {
  return exact ? path === href : path === href || path.startsWith(href + "/");
}

export function NavList({ sections, collapsed, onNavigate }: { sections: NavSection[]; collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {s.label && !collapsed && <p className="px-2.5 pb-1.5 text-[12px] font-medium text-muted-foreground/80">{s.label}</p>}
          {s.label && collapsed && <div className="mx-2.5 mb-1 h-px bg-border" />}
          {s.items.map((it) => {
            const active = isActive(path, it.href, it.exact);
            const link = (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-active text-foreground before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-brand"
                    : "text-muted-foreground hover:bg-sidebar-active/70 hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <it.icon className={cn("size-[17px] shrink-0", active ? "text-brand" : "opacity-80")} aria-hidden />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
            return collapsed ? <Tooltip key={it.href} content={it.label} side="right">{link}</Tooltip> : link;
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections, collapsed, onToggle, labels, footer }: {
  sections: NavSection[]; collapsed: boolean; onToggle: () => void; labels: { collapse: string; expand: string }; footer?: React.ReactNode;
}) {
  return (
    <aside className={cn("dark relative sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar text-foreground transition-[width] duration-200 lg:flex", collapsed ? "w-[60px]" : "w-60")}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(80%_100%_at_0%_0%,rgb(212_175_106/0.10),transparent_70%)]" />
      <div className={cn("relative flex h-14 items-center border-b border-border", collapsed ? "justify-center" : "px-4")}>
        <Logo collapsed={collapsed} />
      </div>
      <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <NavList sections={sections} collapsed={collapsed} />
      </div>
      {footer && !collapsed && <div className="px-3 pb-2">{footer}</div>}
      <div className={cn("border-t border-border p-2", collapsed && "flex justify-center")}>
        <button onClick={onToggle} className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground justify-center lg:justify-start"
          aria-label={collapsed ? labels.expand : labels.collapse}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> {labels.collapse}</>}
        </button>
      </div>
    </aside>
  );
}
