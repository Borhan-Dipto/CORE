"use client";

import { useActionState, useMemo, useState } from "react";
import * as A from "@/app/actions";
import type { FormState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import { CopyButton, Notice, SubmitButton } from "@/components/ui";

const init: FormState = {};

function Field({ label, name, type = "text", required, defaultValue, hint, ...rest }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null; hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <label className="block">
      <span className="label">{label}{hint && <span className="font-normal text-muted"> ({hint})</span>}</span>
      <input className="field" name={name} type={type} required={required} defaultValue={defaultValue ?? undefined} {...rest} />
    </label>
  );
}

// ---------- Auth ----------
export function LoginForm({ t, next }: { t: Dict; next: string }) {
  const [state, action] = useActionState(A.login, init);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label={t.email} name="email" type="email" required autoComplete="email" />
      <Field label={t.password} name="password" type="password" required autoComplete="current-password" />
      <Notice state={state} />
      <SubmitButton className="btn-primary w-full">{t.login}</SubmitButton>
    </form>
  );
}

export function ForgotForm({ t }: { t: Dict }) {
  const [state, action] = useActionState(A.forgotPassword, init);
  return (
    <form action={action} className="space-y-4">
      <Field label={t.email} name="email" type="email" required autoComplete="email" />
      <Notice state={state} />
      <SubmitButton className="btn-primary w-full">{t.sendResetLink}</SubmitButton>
    </form>
  );
}

export function PasswordForm({ t, submitLabel }: { t: Dict; submitLabel: string }) {
  const [state, action] = useActionState(A.setNewPassword, init);
  return (
    <form action={action} className="space-y-4">
      <Field label={t.newPassword} name="password" type="password" required minLength={8} autoComplete="new-password" />
      <Field label={t.confirmPassword} name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      <Notice state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

export function ProfileForm({ t, fullName, email }: { t: Dict; fullName: string; email: string }) {
  const [state, action] = useActionState(A.updateProfile, init);
  return (
    <form action={action} className="space-y-4">
      <Field label={t.fullName} name="full_name" defaultValue={fullName} autoComplete="name" />
      <Field label={t.email} name="email_display" defaultValue={email} disabled />
      <Notice state={state} />
      <SubmitButton>{t.save}</SubmitButton>
    </form>
  );
}

// ---------- Business ----------
type B = Partial<{ id: string; name: string; description: string | null; category: string | null; email: string | null;
  phone: string | null; address: string | null; start_date: string | null; fiscal_year_start_month: number }>;

export function BusinessForm({ t, business, disabled }: { t: Dict; business?: B; disabled?: boolean }) {
  const [state, action] = useActionState(business?.id ? A.updateBusiness : A.createBusiness, init);
  return (
    <form action={action} className="space-y-4">
      {business?.id && <input type="hidden" name="id" value={business.id} />}
      <fieldset disabled={disabled} className="space-y-4">
        <Field label={t.businessName} name="name" required defaultValue={business?.name} maxLength={120} />
        <label className="block">
          <span className="label">{t.description} <span className="font-normal text-muted">({t.optional})</span></span>
          <textarea className="field min-h-20" name="description" defaultValue={business?.description ?? ""} maxLength={1000} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.category} name="category" hint={t.optional} defaultValue={business?.category} />
          <Field label={t.startDate} name="start_date" type="date" hint={t.optional} defaultValue={business?.start_date} />
          <Field label={t.email} name="email" type="email" hint={t.optional} defaultValue={business?.email} />
          <Field label={t.phone} name="phone" type="tel" hint={t.optional} defaultValue={business?.phone} />
        </div>
        <Field label={t.address} name="address" hint={t.optional} defaultValue={business?.address} />
        <label className="block">
          <span className="label">{t.fiscalStart}</span>
          <select className="field" name="fiscal_year_start_month" defaultValue={business?.fiscal_year_start_month ?? 7}>
            {t.months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <Notice state={state} />
        {!disabled && <SubmitButton>{business?.id ? t.save : t.create}</SubmitButton>}
      </fieldset>
    </form>
  );
}

// ---------- Partners ----------
export function InviteForm({ t, businessId }: { t: Dict; businessId: string }) {
  const [state, action] = useActionState(A.createInvite, init);
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="business_id" value={businessId} />
        <div className="flex-1"><Field label={t.email} name="email" type="email" required placeholder="partner@email.com" /></div>
        <SubmitButton>{t.createInvite}</SubmitButton>
      </form>
      <Notice state={{ error: state.error }} />
      {state.link && (
        <div className="rounded-lg border border-line bg-canvas p-3">
          <p className="mb-2 text-sm">{t.inviteReady} <strong>{state.email}</strong></p>
          <div className="flex gap-2">
            <input readOnly value={state.link} className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={state.link} label={t.copy} done={t.copied} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SplitForm({ t, businessId, partners, today }: {
  t: Dict; businessId: string; today: string;
  partners: { user_id: string; name: string; percentage: number }[];
}) {
  const [state, action] = useActionState(A.saveProfitSplit, init);
  const [vals, setVals] = useState(() => partners.map((p) => String(p.percentage)));
  const total = useMemo(() => vals.reduce((s, v) => s + (Number(v) || 0), 0), [vals]);
  const ok = Math.abs(total - 100) < 0.001;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="business_id" value={businessId} />
      {partners.map((p, i) => (
        <div key={p.user_id} className="flex items-center justify-between gap-3">
          <input type="hidden" name="user_id" value={p.user_id} />
          <span className="min-w-0 truncate text-sm">{p.name}</span>
          <div className="flex items-center gap-1">
            <input
              className="field w-24 text-right" name="percentage" inputMode="decimal" value={vals[i]}
              onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <span className="text-sm text-muted">%</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="font-medium">{t.total}</span>
        <span className={`font-semibold ${ok ? "text-profit" : "text-loss"}`}>{total}%</span>
      </div>
      <Field label={t.effectiveFrom} name="effective_from" type="date" required defaultValue={today} />
      <Notice state={state} />
      <SubmitButton className="btn-primary">{t.saveSplit}</SubmitButton>
    </form>
  );
}

// ---------- Invite acceptance ----------
export function AcceptForm({ t, token }: { t: Dict; token: string }) {
  const [state, action] = useActionState(A.acceptInvite, init);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Notice state={state} />
      <SubmitButton className="btn-primary w-full">{t.acceptInvite}</SubmitButton>
    </form>
  );
}

export function SignupForm({ t, token, email }: { t: Dict; token: string; email: string }) {
  const [state, action] = useActionState(A.signupForInvite, init);
  if (state.checkEmail) return <p className="rounded-md border border-line bg-canvas p-3 text-sm">{t.checkEmail}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <Field label={t.email} name="email_display" defaultValue={email} disabled />
      <Field label={t.fullName} name="full_name" required autoComplete="name" />
      <Field label={t.password} name="password" type="password" required minLength={8} autoComplete="new-password" />
      <Field label={t.confirmPassword} name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      <Notice state={state} />
      <SubmitButton className="btn-primary w-full">{t.createAccount}</SubmitButton>
    </form>
  );
}
