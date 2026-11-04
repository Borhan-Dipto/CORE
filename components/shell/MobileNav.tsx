"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, HandCoins, LayoutDashboard, Landmark, Megaphone, Menu as MenuIcon, Plus, Receipt, Search, ShoppingBag, ArrowUpRight, User } from "lucide-react";
import { isActive } from "@/components/shell/Sidebar";
import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground")}>
      <Icon className={cn("size-5", active && "text-brand")} aria-hidden />
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

/** Phone-only bottom bar: main pages one tap away, plus a quick-add button for daily entries. */
export function MobileNav({ t, businessId, canAdd, onMore, onSearch }: { t: Dict; businessId: string | null; canAdd: boolean; onMore: () => void; onSearch: () => void }) {
  const path = usePathname();
  const [open, setOpen] = React.useState(false);
  const b = businessId ? `/b/${businessId}` : null;
  const actions = b ? [
    { href: `${b}/orders?new=order`, label: t.newOrder, icon: ShoppingBag },
    { href: `${b}/expenses?new=expense`, label: t.addExpense, icon: Receipt },
    { href: `${b}/advertising?new=boost`, label: t.addBoost, icon: Megaphone },
    { href: `${b}/capital?new=investment`, label: t.addInvestment, icon: Landmark },
    { href: `${b}/capital?new=withdrawal`, label: t.addWithdrawal, icon: ArrowUpRight },
    { href: `${b}/settlements`, label: t.settlements, icon: HandCoins },
  ] : [];

  return (
    <>
      <nav aria-label={t.menu}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden">
        <div className="mx-auto flex h-15 max-w-lg items-stretch px-1">
          {b ? (
            <>
              <Tab href={b} label={t.dashboard} icon={LayoutDashboard} active={path === b} />
              <Tab href={`${b}/orders`} label={t.orders} icon={ShoppingBag} active={isActive(path, `${b}/orders`)} />
            </>
          ) : (
            <>
              <Tab href="/" label={t.overview} icon={LayoutDashboard} active={path === "/"} />
              <Tab href="/businesses" label={t.businesses} icon={Building2} active={isActive(path, "/businesses")} />
            </>
          )}
          <div className="flex flex-1 items-center justify-center">
            {canAdd && b ? (
              <button type="button" onClick={() => setOpen(true)} aria-label={t.quickAdd}
                className="flex size-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop ring-4 ring-background transition active:scale-95">
                <Plus className="size-6" />
              </button>
            ) : (
              <button type="button" onClick={onSearch} aria-label={t.searchTitle}
                className="flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-medium text-muted-foreground"><Search className="size-5" />{t.searchShort}</button>
            )}
          </div>
          {b ? (
            <Tab href={`${b}/expenses`} label={t.expenses} icon={Receipt} active={isActive(path, `${b}/expenses`)} />
          ) : (
            <Tab href="/account" label={t.account} icon={User} active={isActive(path, "/account")} />
          )}
          <button type="button" onClick={onMore} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium text-muted-foreground">
            <MenuIcon className="size-5" aria-hidden /><span>{t.more}</span>
          </button>
        </div>
      </nav>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-popover p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-pop outline-none data-[state=open]:animate-in">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <DialogPrimitive.Title className="mb-3 text-sm font-semibold">{t.quickAdd}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{t.quickAdd}</DialogPrimitive.Description>
            <div className="grid grid-cols-3 gap-2">
              {actions.map((a) => (
                <Link key={a.href} href={a.href} onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-3.5 text-center text-xs font-medium transition hover:bg-accent active:scale-[0.98]">
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted"><a.icon className="size-4.5" /></span>
                  <span className="leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
