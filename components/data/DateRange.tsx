"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuContent, MenuCheckItem, MenuSeparator, Dialog, DialogContent } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import type { Dict } from "@/lib/i18n";
import type { RangeKey } from "@/lib/range";

export function DateRange({ t, current, from, to }: { t: Dict; current: RangeKey; from: string; to: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(from);
  const [tt, setTt] = React.useState(to);

  const go = (range: RangeKey, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(sp.toString());
    q.set("range", range); q.delete("from"); q.delete("to");
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    router.push(`${path}?${q.toString()}`, { scroll: false });
  };
  const presets: [RangeKey, string][] = [["today", t.today], ["7d", t.last7], ["30d", t.last30], ["month", t.thisMonth], ["prev_month", t.prevMonth], ["year", t.thisYear], ["all", t.allTime]];
  const label = current === "custom" ? `${from} → ${to}` : presets.find(([k]) => k === current)?.[1] ?? t.last30;

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={t.range}><CalendarDays /> {label} <ChevronDown className="text-muted-foreground" /></Button>
        </MenuTrigger>
        <MenuContent className="w-52">
          {presets.map(([k, l]) => <MenuCheckItem key={k} checked={current === k} onSelect={() => go(k)}>{l}</MenuCheckItem>)}
          <MenuSeparator />
          <MenuCheckItem checked={current === "custom"} onSelect={() => setOpen(true)}>{t.custom}…</MenuCheckItem>
        </MenuContent>
      </Menu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t.range} className="sm:max-w-sm">
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (f && tt && f <= tt) { go("custom", { from: f, to: tt }); setOpen(false); } }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.from} htmlFor="dr-from"><Input id="dr-from" type="date" value={f} max={tt} onChange={(e) => setF(e.target.value)} required /></Field>
              <Field label={t.to} htmlFor="dr-to"><Input id="dr-to" type="date" value={tt} min={f} onChange={(e) => setTt(e.target.value)} required /></Field>
            </div>
            <Button type="submit">{t.apply}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
