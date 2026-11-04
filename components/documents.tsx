"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Eye, FileText, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useActionState } from "react";
import * as A from "@/app/actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import type { Dict } from "@/lib/i18n";

type Size = "sm" | "default" | "icon";

/** Preview or download any document (invoice, voucher, receipt, statement) in Bangla or English. */
export function DocumentMenu({ t, href, label, size = "sm", variant = "outline", iconOnly }: {
  t: Dict; href: string; label: string; size?: Size; variant?: "outline" | "ghost" | "default"; iconOnly?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const url = (lang: "bn" | "en", pdf?: boolean) => `${href}${href.includes("?") ? "&" : "?"}lang=${lang}${pdf ? "&format=pdf" : ""}`;

  async function download(lang: "bn" | "en") {
    setBusy(true);
    const id = toast.loading(t.docPreparing);
    try {
      const res = await fetch(url(lang, true));
      if (!res.ok || res.headers.get("content-type") !== "application/pdf") throw new Error(String(res.status));
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "document.pdf");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast.success(t.docReady, { id });
    } catch {
      toast.error(t.docFailed, { id, duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant={variant} size={iconOnly ? "icon" : size} aria-label={label} disabled={busy} className={iconOnly ? "size-8" : undefined}>
          {busy ? <Loader2 className="animate-spin" /> : <FileText />}{!iconOnly && label}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-52">
        <MenuLabel>{label}</MenuLabel>
        <MenuItem onSelect={() => download("bn")}><Download /> {t.docDownload} · {t.langBangla}</MenuItem>
        <MenuItem onSelect={() => download("en")}><Download /> {t.docDownload} · {t.langEnglish}</MenuItem>
        <MenuSeparator />
        <MenuItem asChild><a href={url("bn")} target="_blank" rel="noopener"><Eye /> {t.docPreview} · {t.langBangla}</a></MenuItem>
        <MenuItem asChild><a href={url("en")} target="_blank" rel="noopener"><Eye /> {t.docPreview} · {t.langEnglish}</a></MenuItem>
      </MenuContent>
    </Menu>
  );
}

async function toDataUrl(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const scale = Math.min(1, 600 / img.width, 240 / img.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/png");
    if (out.length > 380000) {
      const w = document.createElement("canvas");
      w.width = c.width; w.height = c.height;
      const x = w.getContext("2d")!;
      x.fillStyle = "#fff"; x.fillRect(0, 0, w.width, w.height); x.drawImage(c, 0, 0);
      out = w.toDataURL("image/jpeg", 0.88);
    }
    if (out.length > 390000) throw new Error("too_big");
    return out;
  } finally {
    URL.revokeObjectURL(src);
  }
}

type Settings = { logo_data: string | null; tagline: string | null; website: string | null; payment_info: string | null; policy_note: string | null; thank_you: string | null; signatory: string | null } | null;

export function InvoiceSettingsForm({ t, businessId, settings, disabled }: { t: Dict; businessId: string; settings: Settings; disabled?: boolean }) {
  const [state, run, pending] = useActionState(A.saveInvoiceSettings, {} as FormState);
  const [logo, setLogo] = React.useState<string | null>(settings?.logo_data ?? null);
  const [changed, setChanged] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); setChanged(false); } }, [state]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setLogo(await toDataUrl(f)); setChanged(true); } catch { toast.error(t.logoTooBig); }
  }

  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="logo_data" value={changed ? logo ?? "" : "__keep__"} />
      <fieldset disabled={disabled} className="grid gap-4">
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t.logo}</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-2">
              {logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pick} aria-label={t.uploadLogo} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus /> {t.uploadLogo}</Button>
              {logo && <Button type="button" variant="ghost" size="sm" onClick={() => { setLogo(null); setChanged(true); }}><Trash2 /> {t.removeLogo}</Button>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t.logoHelp}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.tagline} htmlFor="i-tag" optional={t.optional}><Input id="i-tag" name="tagline" maxLength={120} defaultValue={settings?.tagline ?? ""} /></Field>
          <Field label={t.website} htmlFor="i-web" optional={t.optional}><Input id="i-web" name="website" maxLength={120} defaultValue={settings?.website ?? ""} placeholder="dovenbd.com" /></Field>
        </div>
        <Field label={t.paymentInfo} htmlFor="i-pay" optional={t.optional}><Textarea id="i-pay" name="payment_info" rows={3} maxLength={600} defaultValue={settings?.payment_info ?? ""} placeholder={t.paymentInfoPh} /></Field>
        <Field label={t.policyNote} htmlFor="i-pol" optional={t.optional}><Textarea id="i-pol" name="policy_note" rows={3} maxLength={1200} defaultValue={settings?.policy_note ?? ""} placeholder={t.policyNotePh} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.thankYou} htmlFor="i-ty" optional={t.optional}><Input id="i-ty" name="thank_you" maxLength={300} defaultValue={settings?.thank_you ?? ""} placeholder={t.thankYouPh} /></Field>
          <Field label={t.signatory} htmlFor="i-sig" optional={t.optional}><Input id="i-sig" name="signatory" maxLength={120} defaultValue={settings?.signatory ?? ""} placeholder={t.signatoryPh} /></Field>
        </div>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {!disabled && <div><Button type="submit" loading={pending}>{t.save}</Button></div>}
    </form>
  );
}
