"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Copy, Link2, MessageCircle, Plus, RefreshCw, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import * as A from "@/app/actions";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Avatar } from "@/components/ui/avatar";
import { fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const init: FormState = {};

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">{msg}</p> : null;
}
function useToastOk(state: FormState, after?: () => void) {
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); after?.(); } }, [state.at]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------- Auth ----------
export function LoginForm({ t, next }: { t: Dict; next: string }) {
  const [state, run, pending] = useActionState(A.login, init);
  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label={t.email} htmlFor="l-email"><Input id="l-email" name="email" type="email" required autoComplete="email" autoFocus /></Field>
      <Field label={t.password} htmlFor="l-pass"><Input id="l-pass" name="password" type="password" required autoComplete="current-password" /></Field>
      <ErrorText msg={state.error} />
      <Button type="submit" loading={pending} className="w-full">{t.login}</Button>
    </form>
  );
}

export function ForgotForm({ t }: { t: Dict }) {
  const [state, run, pending] = useActionState(A.forgotPassword, init);
  if (state.ok) return <p className="rounded-md border border-success/25 bg-success-soft px-3 py-3 text-[13px] text-success">{state.ok}</p>;
  return (
    <form action={run} className="grid gap-4">
      <Field label={t.email} htmlFor="f-email"><Input id="f-email" name="email" type="email" required autoComplete="email" autoFocus /></Field>
      <ErrorText msg={state.error} />
      <Button type="submit" loading={pending} className="w-full">{t.sendResetLink}</Button>
    </form>
  );
}

export function PasswordForm({ t, redirectTo }: { t: Dict; redirectTo?: string }) {
  const [state, run, pending] = useActionState(A.setNewPassword, init);
  const router = useRouter();
  const ref = React.useRef<HTMLFormElement>(null);
  useToastOk(state, () => { ref.current?.reset(); if (redirectTo) router.push(redirectTo); });
  return (
    <form ref={ref} action={run} className="grid gap-4 sm:max-w-sm">
      <Field label={t.newPassword} htmlFor="p-new" hint={t.passwordTooShort}><Input id="p-new" name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Field label={t.confirmPassword} htmlFor="p-conf"><Input id="p-conf" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <ErrorText msg={state.error} />
      <div><Button type="submit" loading={pending}>{t.savePassword}</Button></div>
    </form>
  );
}

export function ProfileForm({ t, fullName, email }: { t: Dict; fullName: string; email: string }) {
  const [state, run, pending] = useActionState(A.updateProfile, init);
  useToastOk(state);
  return (
    <form action={run} className="grid gap-4 sm:max-w-sm">
      <Field label={t.fullName} htmlFor="pr-name"><Input id="pr-name" name="full_name" defaultValue={fullName} autoComplete="name" maxLength={80} /></Field>
      <Field label={t.email} htmlFor="pr-email"><Input id="pr-email" value={email} disabled readOnly /></Field>
      <ErrorText msg={state.error} />
      <div><Button type="submit" loading={pending}>{t.save}</Button></div>
    </form>
  );
}

// ---------- Invite acceptance ----------
export function AcceptForm({ t, token }: { t: Dict; token: string }) {
  const [state, run, pending] = useActionState(A.acceptInvite, init);
  return (
    <form action={run} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <ErrorText msg={state.error} />
      <Button type="submit" loading={pending} className="w-full"><Check /> {t.acceptInvite}</Button>
    </form>
  );
}

export function InviteAuth({ t, token, email }: { t: Dict; token: string; email: string }) {
  const [mode, setMode] = React.useState<"signup" | "login">("signup");
  const [su, runSu, pSu] = useActionState(A.signupForInvite, init);
  const [li, runLi, pLi] = useActionState(A.loginForInvite, init);
  if (su.checkEmail) return <p className="rounded-md border border-brand/25 bg-brand-soft px-3 py-3 text-[13px] text-brand">{t.checkEmail}</p>;
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {(["signup", "login"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)}
            className={cn("h-8 rounded-md text-[13px] font-medium transition", mode === m ? "bg-card shadow-card" : "text-muted-foreground")}>
            {m === "signup" ? t.createAccount : t.login}
          </button>
        ))}
      </div>
      {mode === "signup" ? (
        <form action={runSu} className="grid gap-4">
          <input type="hidden" name="token" value={token} /><input type="hidden" name="email" value={email} />
          <Field label={t.email} htmlFor="s-e"><Input id="s-e" value={email} disabled readOnly /></Field>
          <Field label={t.fullName} htmlFor="s-n"><Input id="s-n" name="full_name" required autoComplete="name" maxLength={80} /></Field>
          <Field label={t.password} htmlFor="s-p" hint={t.passwordTooShort}><Input id="s-p" name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label={t.confirmPassword} htmlFor="s-c"><Input id="s-c" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <ErrorText msg={su.error} />
          <Button type="submit" loading={pSu} className="w-full">{t.createAccount}</Button>
        </form>
      ) : (
        <form action={runLi} className="grid gap-4">
          <input type="hidden" name="token" value={token} /><input type="hidden" name="email" value={email} />
          <Field label={t.email} htmlFor="i-e"><Input id="i-e" value={email} disabled readOnly /></Field>
          <Field label={t.password} htmlFor="i-p"><Input id="i-p" name="password" type="password" required autoComplete="current-password" /></Field>
          <ErrorText msg={li.error} />
          <Button type="submit" loading={pLi} className="w-full">{t.login}</Button>
        </form>
      )}
    </div>
  );
}

// ---------- Business ----------
type B = Partial<{ id: string; name: string; description: string | null; category: string | null; email: string | null;
  phone: string | null; address: string | null; start_date: string | null; fiscal_year_start_month: number }>;

export function BusinessFields({ t, business, disabled }: { t: Dict; business?: B; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4">
      <Field label={t.businessName} htmlFor="b-name"><Input id="b-name" name="name" required defaultValue={business?.name ?? ""} maxLength={120} autoFocus={!business?.id} /></Field>
      <Field label={t.description} htmlFor="b-desc" optional={t.optional}><Textarea id="b-desc" name="description" defaultValue={business?.description ?? ""} maxLength={1000} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.category} htmlFor="b-cat" optional={t.optional}><Input id="b-cat" name="category" defaultValue={business?.category ?? ""} placeholder="E-commerce" /></Field>
        <Field label={t.startDate} htmlFor="b-start" optional={t.optional}><Input id="b-start" name="start_date" type="date" defaultValue={business?.start_date ?? ""} /></Field>
        <Field label={t.email} htmlFor="b-email" optional={t.optional}><Input id="b-email" name="email" type="email" defaultValue={business?.email ?? ""} /></Field>
        <Field label={t.phone} htmlFor="b-phone" optional={t.optional}><Input id="b-phone" name="phone" type="tel" defaultValue={business?.phone ?? ""} /></Field>
      </div>
      <Field label={t.address} htmlFor="b-addr" optional={t.optional}><Input id="b-addr" name="address" defaultValue={business?.address ?? ""} /></Field>
      <Field label={t.fiscalStart} htmlFor="b-fy">
        <Select id="b-fy" name="fiscal_year_start_month" defaultValue={String(business?.fiscal_year_start_month ?? 7)}
          options={t.months.map((m, i) => ({ value: String(i + 1), label: m }))} disabled={disabled} />
      </Field>
    </fieldset>
  );
}

export function BusinessEditForm({ t, business, disabled }: { t: Dict; business: B; disabled?: boolean }) {
  const [state, run, pending] = useActionState(A.updateBusiness, init);
  useToastOk(state);
  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="id" value={business.id} />
      <BusinessFields t={t} business={business} disabled={disabled} />
      <ErrorText msg={state.error} />
      {!disabled && <div><Button type="submit" loading={pending}>{t.save}</Button></div>}
    </form>
  );
}

export function NewBusinessDialog({ t, variant = "default" }: { t: Dict; variant?: "default" | "outline" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = React.useState(sp.get("new") === "1");
  const [state, run, pending] = useActionState(A.createBusiness, init);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && sp.get("new")) router.replace("/businesses"); }}>
      <DialogTrigger asChild><Button variant={variant}><Plus /> {t.newBusiness}</Button></DialogTrigger>
      <DialogContent title={t.newBusiness} description={t.appDescription}>
        <form action={run} className="grid gap-4">
          <BusinessFields t={t} />
          <ErrorText msg={state.error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
            <Button type="submit" loading={pending}>{t.create}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveButton({ t, id, archived }: { t: Dict; id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  if (archived) return <Button loading={pending} onClick={() => start(() => A.setBusinessStatus(id, "active"))}><ArchiveRestore /> {t.restoreBusiness}</Button>;
  return (
    <ConfirmDialog title={t.confirmArchive} description={t.archiveHelp} confirmLabel={t.archiveBusiness} cancelLabel={t.cancel} destructive
      onConfirm={() => A.setBusinessStatus(id, "archived")}
      trigger={<Button variant="destructive-outline"><Archive /> {t.archiveBusiness}</Button>} />
  );
}

export function DeleteBusinessButton({ t, id, name }: { t: Dict; id: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, start] = useTransition();
  const [error, setError] = React.useState<string>();
  const match = typed.trim() === name.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTyped(""); setError(undefined); } }}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 /> {t.deleteBusiness}</Button></DialogTrigger>
      <DialogContent title={t.deleteBusinessTitle} description={t.deleteBusinessDesc}>
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!match) return;
          start(async () => {
            const r = await A.deleteBusiness(id, typed);
            if (r?.error) setError(r.error);
          });
        }}>
          <ul className="grid gap-1 rounded-lg border border-destructive/25 bg-destructive-soft px-4 py-3 text-[13px] text-destructive">
            {t.deleteBusinessList.map((x) => <li key={x}>• {x}</li>)}
          </ul>
          <Field label={t.deleteBusinessType.replace("{name}", name)} htmlFor="del-name">
            <Input id="del-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={name} />
          </Field>
          <ErrorText msg={error} />
          <Button type="submit" variant="destructive" disabled={!match} loading={pending}><Trash2 /> {t.deleteBusinessConfirm}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Partners ----------
function InviteResult({ t, link, email, businessName }: { t: Dict; link: string; email: string; businessName: string }) {
  const [copied, setCopied] = React.useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t.inviteMessage.replace("{biz}", businessName)}\n${link}`)}`;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-3 py-2 text-[13px] text-success">
        <Check className="size-4" /> {t.inviteReadyDesc} <strong className="truncate">{email}</strong>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
        <Button variant="outline" size="icon" aria-label={t.copy} onClick={async () => {
          try { await navigator.clipboard.writeText(link); setCopied(true); toast.success(t.copied); setTimeout(() => setCopied(false), 2000); } catch {}
        }}>{copied ? <Check /> : <Copy />}</Button>
      </div>
      <Button asChild className="bg-[#25D366] text-white hover:bg-[#1fb857]">
        <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle /> {t.sendWhatsApp}</a>
      </Button>
    </div>
  );
}

export function InviteDialog({ t, businessId, businessName }: { t: Dict; businessId: string; businessName: string }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setKey((k) => k + 1); }}>
      <DialogTrigger asChild><Button><UserPlus /> {t.invitePartner}</Button></DialogTrigger>
      <DialogContent title={t.invitePartner} description={t.inviteHelp}>
        <InviteForm key={key} t={t} businessId={businessId} businessName={businessName} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ t, businessId, businessName }: { t: Dict; businessId: string; businessName: string }) {
  const [state, run, pending] = useActionState(A.createInvite, init);
  if (state.link) return <InviteResult t={t} link={state.link} email={state.email!} businessName={businessName} />;
  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} />
      <Field label={t.email} htmlFor="inv-email"><Input id="inv-email" name="email" type="email" required placeholder="partner@gmail.com" autoFocus /></Field>
      <ErrorText msg={state.error} />
      <Button type="submit" loading={pending}><Link2 /> {t.createInvite}</Button>
    </form>
  );
}

export function PendingInviteActions({ t, id, businessId, email, businessName }: { t: Dict; id: string; businessId: string; email: string; businessName: string }) {
  const [link, setLink] = React.useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" loading={pending} onClick={() => start(async () => {
        const r = await A.reissueInvite(id, businessId, email);
        if (r.error) toast.error(r.error); else setLink(r.link);
      })}><RefreshCw /> {t.newLink}</Button>
      <ConfirmDialog title={t.revoke} description={email} confirmLabel={t.revoke} cancelLabel={t.cancel} destructive
        onConfirm={async () => { await A.revokeInvite(id, businessId); toast.success(t.inviteRevoked); }}
        trigger={<Button variant="ghost" size="icon-sm" aria-label={t.revoke}><X /></Button>} />
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(undefined)}>
        <DialogContent title={t.inviteReady}>{link && <InviteResult t={t} link={link} email={email} businessName={businessName} />}</DialogContent>
      </Dialog>
    </div>
  );
}

export function RemoveMemberButton({ t, memberId, businessId, name }: { t: Dict; memberId: string; businessId: string; name: string }) {
  return (
    <ConfirmDialog title={`${t.confirmRemove}`} description={`${name} — ${t.confirmRemoveDesc}`} confirmLabel={t.remove} cancelLabel={t.cancel} destructive
      onConfirm={async () => { await A.removeMember(memberId, businessId); toast.success(t.partnerRemoved); }}
      trigger={<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><UserMinus /> <span className="hidden sm:inline">{t.remove}</span></Button>} />
  );
}

export function RejoinButton({ t, businessId }: { t: Dict; businessId: string }) {
  const [pending, start] = useTransition();
  return <Button variant="outline" loading={pending} onClick={() => start(() => A.rejoinAsPartner(businessId))}><UserPlus /> {t.rejoinAsPartner}</Button>;
}

export function SplitForm({ t, lang, businessId, partners, today }: {
  t: Dict; lang: Lang; businessId: string; today: string; partners: { user_id: string; name: string; percentage: number }[];
}) {
  const [state, run, pending] = useActionState(A.saveProfitSplit, init);
  useToastOk(state);
  const [vals, setVals] = React.useState(() => partners.map((p) => String(p.percentage)));
  const total = vals.reduce((s, v) => s + (Number(v) || 0), 0);
  const ok = Math.abs(total - 100) < 0.001;
  return (
    <form action={run} className="grid gap-3">
      <input type="hidden" name="business_id" value={businessId} />
      {partners.map((p, i) => (
        <div key={p.user_id} className="flex items-center gap-3">
          <input type="hidden" name="user_id" value={p.user_id} />
          <Avatar name={p.name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
          <div className="relative w-24">
            <Input name="percentage" inputMode="decimal" value={vals[i]} aria-label={`${p.name} %`} className="tabular pr-7 text-right"
              onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
      ))}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full transition-all", ok ? "bg-success" : total > 100 ? "bg-destructive" : "bg-warning")} style={{ width: `${Math.min(100, total)}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t.total}</span>
        <span className={cn("tabular font-semibold", ok ? "text-success" : "text-destructive")}>{ok ? "✓ " : "✕ "}{fmtNum(total, lang, total % 1 ? 2 : 0)}%</span>
      </div>
      <Field label={t.effectiveFrom} htmlFor="sp-date"><Input id="sp-date" name="effective_from" type="date" required defaultValue={today} /></Field>
      <ErrorText msg={state.error} />
      <Button type="submit" loading={pending} disabled={!ok}>{t.saveSplit}</Button>
    </form>
  );
}

export function ToggleActive({ action, active, labels }: { action: () => Promise<void>; active: boolean; labels: { on: string; off: string } }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(action)} className="text-muted-foreground">
      {active ? labels.off : labels.on}
    </Button>
  );
}
