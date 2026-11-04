"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Globe, KeyRound, PlugZap, RefreshCw, Unplug } from "lucide-react";
import * as A from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { fmtDate, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type Integration = { token_hint: string; created_at: string; last_event_at: string | null; events_count: number; orders_created: number; last_error: string | null; last_error_at: string | null } | null;

function CopyField({ value, label, t }: { value: string; label: string; t: Dict }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <Button type="button" variant="outline" size="icon" aria-label={t.copy} onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); toast.success(t.copied); setTimeout(() => setCopied(false), 2000); } catch {}
        }}>{copied ? <Check /> : <Copy />}</Button>
      </div>
    </div>
  );
}

const STEPS: Record<"woo" | "shopify" | "other", (t: Dict) => string[]> = {
  woo: (t) => t.syncWooSteps, shopify: (t) => t.syncShopifySteps, other: (t) => t.syncOtherSteps,
};

export function WebsiteSyncCard({ t, lang, businessId, integration, disabled }: { t: Dict; lang: Lang; businessId: string; integration: Integration; disabled?: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [busy, start] = React.useTransition();
  const [tab, setTab] = React.useState<"woo" | "shopify" | "other">("woo");
  const token = url?.split("/").pop() ?? "";

  const generate = () => start(async () => {
    const r = await A.createWebhookLink(businessId);
    if (r.error) toast.error(r.error); else { setUrl(r.url!); toast.success(t.syncLinkReady); }
  });

  const connected = !!integration;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={connected ? "success" : "neutral"}>{connected ? <PlugZap /> : <Unplug />} {connected ? t.syncOn : t.syncOff}</Badge>
        {connected && (
          <span className="text-xs text-muted-foreground">
            {t.syncKey} …{integration!.token_hint} · {fmtNum(integration!.orders_created, lang)} {t.syncOrdersImported} · {fmtNum(integration!.events_count, lang)} {t.syncEvents}
            {integration!.last_event_at ? ` · ${t.syncLast} ${fmtDate(integration!.last_event_at, lang, true)}` : ""}
          </span>
        )}
      </div>
      {integration?.last_error && (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
          {t.syncLastError} ({fmtDate(integration.last_error_at, lang, true)}): <span className="font-mono text-xs">{integration.last_error}</span>
        </p>
      )}

      {url ? (
        <div className="grid gap-4 rounded-lg border border-brand/30 bg-brand-soft/40 p-4">
          <p className="flex items-start gap-2 text-[13px]"><KeyRound className="mt-0.5 size-4 shrink-0 text-brand" /> {t.syncShowOnce}</p>
          <CopyField value={url} label={t.syncUrl} t={t} />
          <CopyField value={token} label={t.syncSecret} t={t} />
          <div className="grid gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1 text-[13px]">
              {(["woo", "shopify", "other"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={cn("flex-1 rounded-md px-2 py-1.5 font-medium transition", tab === k ? "bg-card shadow-card" : "text-muted-foreground hover:text-foreground")}>
                  {k === "woo" ? "WooCommerce" : k === "shopify" ? "Shopify" : t.syncOther}
                </button>
              ))}
            </div>
            <ol className="grid list-decimal gap-1.5 pl-5 text-[13px]">{STEPS[tab](t).map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        </div>
      ) : null}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <ConfirmDialog title={t.syncRegenerate} description={t.syncRegenerateDesc} confirmLabel={t.syncRegenerate} cancelLabel={t.cancel}
              onConfirm={generate} trigger={<Button variant="outline" loading={busy}><RefreshCw /> {t.syncRegenerate}</Button>} />
          ) : (
            <Button onClick={generate} loading={busy}><Globe /> {t.syncConnect}</Button>
          )}
          {connected && (
            <ConfirmDialog destructive title={t.syncDisconnect} description={t.syncDisconnectDesc} confirmLabel={t.syncDisconnect} cancelLabel={t.cancel}
              onConfirm={async () => { const r = await A.disableWebhook(businessId); if (r.error) toast.error(r.error); else { setUrl(null); toast.success(t.saved); } }}
              trigger={<Button variant="ghost" className="text-destructive"><Unplug /> {t.syncDisconnect}</Button>} />
          )}
        </div>
      )}
    </div>
  );
}
