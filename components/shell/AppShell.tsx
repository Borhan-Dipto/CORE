"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronsUpDown, Languages, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Search, Sun, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuCheckItem, SheetContent } from "@/components/ui/overlay";
import { Sidebar, NavList } from "@/components/shell/Sidebar";
import { Logo } from "@/components/shell/Logo";
import { navSections } from "@/components/shell/nav";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { MobileNav } from "@/components/shell/MobileNav";
import { SearchPalette } from "@/components/shell/SearchPalette";
import { logout, setLang, setTheme } from "@/app/actions";
import type { Dict, Lang } from "@/lib/i18n";
import type { Theme } from "@/lib/session";
import { cn } from "@/lib/utils";

type B = { id: string; name: string; status: string };

export function AppShell({ children, t, lang, theme, isOwner, user, businesses, initialCollapsed, unread = 0 }: {
  children: React.ReactNode; t: Dict; lang: Lang; theme: Theme; isOwner: boolean;
  user: { name: string; email: string }; businesses: B[]; initialCollapsed: boolean; unread?: number;
}) {
  const path = usePathname();
  const businessId = path.match(/^\/b\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const current = businesses.find((b) => b.id === businessId);
  const sections = navSections(t, businessId, isOwner);
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `sidebar=${c ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar sections={sections} collapsed={collapsed} onToggle={toggle} labels={{ collapse: t.collapse, expand: t.expand }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t.menu}><MenuIcon /></Button>
            </DialogPrimitive.Trigger>
            <SheetContent label={t.menu}>
              <div className="flex h-14 items-center border-b border-border px-4"><Logo /></div>
              <div className="flex-1 overflow-y-auto p-3"><NavList sections={sections} onNavigate={() => setMobileOpen(false)} /></div>
            </SheetContent>
          </DialogPrimitive.Root>
          <div className="lg:hidden"><Logo collapsed /></div>

          <BusinessSwitcher t={t} businesses={businesses} current={current} isOwner={isOwner} />

          <button type="button" onClick={() => setSearchOpen(true)}
            className="ml-2 hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-[13px] text-muted-foreground transition hover:bg-accent md:flex lg:w-72">
            <Search className="size-3.5" /><span className="flex-1 truncate text-left">{t.searchTitle}…</span>
            <kbd className="rounded border border-border bg-background px-1 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t.searchTitle} onClick={() => setSearchOpen(true)}><Search /></Button>
            <NotificationBell t={t} lang={lang} initialUnread={unread} />
            <LangToggle lang={lang} />
            <div className="hidden sm:block"><ThemeMenu t={t} theme={theme} /></div>
            <UserMenu t={t} user={user} theme={theme} />
          </div>
        </header>
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
        <MobileNav t={t} businessId={businessId} canAdd={isOwner && current?.status !== "archived"} onMore={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
        <SearchPalette t={t} lang={lang} sections={sections} businessId={businessId} businesses={businesses} open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </div>
  );
}

function BusinessSwitcher({ t, businesses, current, isOwner }: { t: Dict; businesses: B[]; current?: B; isOwner: boolean }) {
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="ml-1 flex h-9 min-w-0 max-w-[60vw] items-center gap-2 rounded-md px-2 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 sm:max-w-72">
          {current ? <Avatar name={current.name} seed={current.id} size="sm" square /> : <Building2 className="size-4 text-muted-foreground" />}
          <span className="truncate">{current?.name ?? t.allBusinesses}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{t.switchBusiness}</MenuLabel>
        <MenuItem onSelect={() => router.push("/")}><Building2 /> {t.allBusinesses}{!current && <Check className="ml-auto !text-foreground" />}</MenuItem>
        <MenuSeparator />
        {businesses.map((b) => (
          <MenuItem key={b.id} onSelect={() => router.push(`/b/${b.id}`)}>
            <Avatar name={b.name} seed={b.id} size="sm" square />
            <span className={cn("truncate", b.status === "archived" && "text-muted-foreground")}>{b.name}</span>
            {current?.id === b.id && <Check className="ml-auto !text-foreground" />}
          </MenuItem>
        ))}
        {isOwner && <>
          <MenuSeparator />
          <MenuItem onSelect={() => router.push("/businesses?new=1")}><Plus /> {t.newBusiness}</MenuItem>
        </>}
      </MenuContent>
    </Menu>
  );
}

function LangToggle({ lang }: { lang: Lang }) {
  const [pending, start] = React.useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} aria-label="Language / ভাষা" className="gap-1.5 px-2"
      onClick={() => start(() => setLang(lang === "bn" ? "en" : "bn"))}>
      <Languages /> <span className="text-[13px]">{lang === "bn" ? "EN" : "বাং"}</span>
    </Button>
  );
}

function ThemeMenu({ t, theme }: { t: Dict; theme: Theme }) {
  const [, start] = React.useTransition();
  const apply = (v: Theme) => {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    start(() => setTheme(v));
  };
  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <Menu>
      <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t.theme}><Icon /></Button></MenuTrigger>
      <MenuContent className="w-40">
        <MenuLabel>{t.theme}</MenuLabel>
        {([["light", t.light, Sun], ["dark", t.dark, Moon], ["system", t.system, Monitor]] as const).map(([v, label, I]) => (
          <MenuCheckItem key={v} checked={theme === v} onSelect={() => apply(v)}><I className="size-4" /> {label}</MenuCheckItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function UserMenu({ t, user, theme }: { t: Dict; user: { name: string; email: string }; theme: Theme }) {
  const router = useRouter();
  const [, start] = React.useTransition();
  const apply = (v: Theme) => {
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    start(() => setTheme(v));
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60" aria-label={t.account}>
          <Avatar name={user.name || user.email} seed={user.email} size="md" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/account")}><User /> {t.account}</MenuItem>
        <div className="sm:hidden">
          <MenuSeparator />
          <MenuLabel>{t.theme}</MenuLabel>
          {([["light", t.light, Sun], ["dark", t.dark, Moon], ["system", t.system, Monitor]] as const).map(([v, label, I]) => (
            <MenuCheckItem key={v} checked={theme === v} onSelect={() => apply(v)}><I className="size-4" /> {label}</MenuCheckItem>
          ))}
          <MenuSeparator />
        </div>
        <MenuItem onSelect={() => logout()}><LogOut /> {t.logout}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
