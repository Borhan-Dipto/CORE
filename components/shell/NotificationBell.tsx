"use client";

import * as React from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, HandCoins, Landmark, Megaphone, Receipt, Undo2, BarChart3, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyNotifications, markNotificationsRead } from "@/app/actions";
import { notificationText } from "@/lib/notify/text";
import type { Dict, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type N = Awaited<ReturnType<typeof getMyNotifications>>[number];

const ICON: Record<string, typeof Bell> = {
  expense: Receipt, investment: Landmark, withdrawal: ArrowUpRight, payout: HandCoins, reversal: Undo2,
  settlement: HandCoins, settlement_void: Undo2, weekly: BarChart3,
};

function ago(iso: string, lang: Lang) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === "bn" ? "bn-BD" : "en", { numeric: "auto" });
  if (s < 60) return rtf.format(0, "second");
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  return rtf.format(-Math.floor(s / 86400), "day");
}

export function NotificationBell({ t, lang, initialUnread }: { t: Dict; lang: Lang; initialUnread: number }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<N[] | null>(null);
  const [unread, setUnread] = React.useState(initialUnread);
  React.useEffect(() => setUnread(initialUnread), [initialUnread]);

  async function load() {
    const list = await getMyNotifications();
    setItems(list);
    setUnread(list.filter((n) => !n.read_at).length);
  }
  async function readAll() {
    await markNotificationsRead();
    setItems((l) => l?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? l);
    setUnread(0);
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.notifications} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white tabular">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12}
          className="z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-pop data-[state=open]:animate-in">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{t.notifications}</p>
            {unread > 0 && <Button variant="ghost" size="sm" onClick={readAll}><CheckCheck /> {t.markAllRead}</Button>}
          </div>
          <div className="max-h-[min(460px,70dvh)] overflow-y-auto">
            {items === null ? (
              <div className="grid gap-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />)}</div>
            ) : items.length === 0 ? (
              <div className="grid place-items-center gap-2 px-6 py-10 text-center">
                <Bell className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">{t.noNotifications}</p>
                <p className="text-xs text-muted-foreground">{t.noNotificationsDesc}</p>
              </div>
            ) : items.map((n) => {
              const { title, body } = notificationText(n.kind, (n.payload ?? {}) as Record<string, unknown>, lang);
              const Icon = ICON[n.kind] ?? Bell;
              const ad = n.kind === "expense" && (n.payload as Record<string, unknown>)?.ad === true;
              return (
                <Link key={n.id} href={n.link ?? "/"} onClick={() => { setOpen(false); if (!n.read_at) markNotificationsRead([n.id]); }}
                  className={cn("flex gap-3 border-b border-border px-4 py-3 last:border-0 transition hover:bg-accent", !n.read_at && "bg-brand-soft/40")}>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {ad ? <Megaphone className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium leading-snug">{title}</span>
                      {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{body}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">{ago(n.created_at, lang)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
