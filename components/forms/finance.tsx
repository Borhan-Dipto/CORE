"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import * as A from "@/app/actions";
import type { FormState } from "@/app/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n";

export type Opts = {
  accounts: { id: string; name: string; type: string; is_active: boolean }[];
  categories: { id: string; name: string; is_advertising: boolean; is_active: boolean }[];
  partners: { user_id: string; name: string }[];
};
type Action = (s: FormState, fd: FormData) => Promise<FormState>;
const init: FormState = {};

/** Dialog + form wired to a server action: inline error, toast + close on success. */
function EntryDialog({ action, title, description, trigger, children, businessId, t, submit }: {
  action: Action; title: string; description?: string; trigger: React.ReactNode; children: (state: FormState) => React.ReactNode;
  businessId: string; t: Dict; submit: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setKey((k) => k + 1); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <EntryForm key={key} action={action} businessId={businessId} t={t} submit={submit} onDone={() => setOpen(false)}>{children}</EntryForm>
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ action, businessId, t, submit, onDone, children }: {
  action: Action; businessId: string; t: Dict; submit: string; onDone: () => void; children: (s: FormState) => React.ReactNode;
}) {
  const [state, run, pending] = useActionState(action, init);
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); onDone(); } }, [state.at]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={run} className="grid gap-4" noValidate={false}>
      <input type="hidden" name="business_id" value={businessId} />
      {children(state)}
      {state.error && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">{state.error}</p>}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>{t.cancel}</Button>
        <Button type="submit" loading={pending}>{submit}</Button>
      </div>
    </form>
  );
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

function AmountDate({ t }: { t: Dict }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={`${t.amount} (৳)`} htmlFor="f-amount">
        <Input id="f-amount" name="amount" inputMode="decimal" required placeholder="0" pattern="[0-9.,]*" className="tabular text-base font-medium" autoFocus />
      </Field>
      <Field label={t.date} htmlFor="f-date"><Input id="f-date" name="date" type="date" required defaultValue={today()} max={today()} /></Field>
    </div>
  );
}

function accountOptions(o: Opts, t: Dict) {
  return o.accounts.filter((a) => a.is_active).map((a) => ({ value: a.id, label: a.name, hint: t.accountTypes[a.type] }));
}

// ---------- Expense / boosting ----------
export function ExpenseDialog({ t, businessId, opts, advertising, trigger, variant = "default" }: {
  t: Dict; businessId: string; opts: Opts; advertising?: boolean; trigger?: React.ReactNode; variant?: ButtonProps["variant"];
}) {
  const cats = opts.categories.filter((c) => c.is_active);
  const adCat = cats.find((c) => c.is_advertising);
  return (
    <EntryDialog action={A.recordExpense} businessId={businessId} t={t}
      title={advertising ? t.addBoost : t.addExpense} submit={advertising ? t.addBoost : t.addExpense}
      trigger={trigger ?? <Button variant={variant}><Plus /> {advertising ? t.addBoost : t.addExpense}</Button>}>
      {() => <ExpenseFields t={t} opts={opts} cats={cats} defaultCat={advertising ? adCat?.id : undefined} />}
    </EntryDialog>
  );
}

function ExpenseFields({ t, opts, cats, defaultCat }: { t: Dict; opts: Opts; cats: Opts["categories"]; defaultCat?: string }) {
  const [cat, setCat] = React.useState(defaultCat ?? "");
  const [source, setSource] = React.useState<"account" | "partner">("account");
  const isAd = cats.find((c) => c.id === cat)?.is_advertising;
  return (
    <>
      <AmountDate t={t} />
      <Field label={t.category} htmlFor="f-cat">
        <Select id="f-cat" name="category_id" value={cat} onValueChange={setCat} required placeholder={t.category}
          options={cats.map((c) => ({ value: c.id, label: c.name }))} />
      </Field>
      <Field label={t.title} htmlFor="f-title" optional={t.optional}>
        <Input id="f-title" name="title" maxLength={120} placeholder={t.titlePh} />
      </Field>
      {isAd && (
        <div className="grid gap-3 rounded-lg border border-brand/20 bg-brand-soft/50 p-3 sm:grid-cols-2">
          <Field label={t.platform} htmlFor="f-plat">
            <Select id="f-plat" name="ad_platform" defaultValue="facebook" options={Object.entries(t.platforms).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label={t.targetProduct} htmlFor="f-prod" optional={t.optional}><Input id="f-prod" name="target_product" maxLength={120} /></Field>
          <Field label={t.campaign} htmlFor="f-camp" optional={t.optional} className="sm:col-span-2"><Input id="f-camp" name="campaign" maxLength={120} /></Field>
        </div>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[13px] font-medium">{t.paidFrom}</legend>
        <input type="hidden" name="source" value={source} />
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
          {(["account", "partner"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={source === s} onClick={() => setSource(s)}
              className={cn("h-8 rounded-md text-[13px] font-medium transition", source === s ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}>
              {s === "account" ? t.paidFromAccount : t.partner}
            </button>
          ))}
        </div>
        {source === "account"
          ? <Select name="account_id" required placeholder={t.account_} options={accountOptions(opts, t)} />
          : <>
              <Select name="partner_id" required placeholder={t.partner} options={opts.partners.map((p) => ({ value: p.user_id, label: p.name }))} />
              <p className="text-xs text-muted-foreground">{t.paidByPartnerHint}</p>
            </>}
      </fieldset>
      <Field label={t.reference} htmlFor="f-ref" optional={t.optional}><Input id="f-ref" name="reference" maxLength={80} placeholder={t.referencePh} /></Field>
    </>
  );
}

// ---------- Capital ----------
export function InvestmentDialog({ t, businessId, opts, variant = "default" }: { t: Dict; businessId: string; opts: Opts; variant?: ButtonProps["variant"] }) {
  return (
    <EntryDialog action={A.recordInvestment} businessId={businessId} t={t} title={t.addInvestment} submit={t.addInvestment}
      trigger={<Button variant={variant}><Plus /> {t.addInvestment}</Button>}>
      {() => (
        <>
          <AmountDate t={t} />
          <Field label={t.partner} htmlFor="i-p"><Select id="i-p" name="partner_id" required placeholder={t.partner} options={opts.partners.map((p) => ({ value: p.user_id, label: p.name }))} /></Field>
          <Field label={t.receivedInto} htmlFor="i-a">
            <Select id="i-a" name="account_id" defaultValue={opts.accounts.find((a) => a.is_active)?.id} options={[...accountOptions(opts, t), { value: "none", label: t.notDeposited }]} />
          </Field>
          <Field label={t.note} htmlFor="i-n" optional={t.optional}><Input id="i-n" name="title" maxLength={120} /></Field>
          <Field label={t.reference} htmlFor="i-r" optional={t.optional}><Input id="i-r" name="reference" maxLength={80} placeholder={t.referencePh} /></Field>
        </>
      )}
    </EntryDialog>
  );
}

export function WithdrawalDialog({ t, businessId, opts }: { t: Dict; businessId: string; opts: Opts }) {
  return (
    <EntryDialog action={A.recordWithdrawal} businessId={businessId} t={t} title={t.addWithdrawal} submit={t.addWithdrawal}
      trigger={<Button variant="outline">{t.addWithdrawal}</Button>}>
      {() => (
        <>
          <AmountDate t={t} />
          <Field label={t.partner} htmlFor="w-p"><Select id="w-p" name="partner_id" required placeholder={t.partner} options={opts.partners.map((p) => ({ value: p.user_id, label: p.name }))} /></Field>
          <Field label={t.fromAccount} htmlFor="w-a"><Select id="w-a" name="account_id" required placeholder={t.account_} options={accountOptions(opts, t)} /></Field>
          <Field label={t.note} htmlFor="w-n" optional={t.optional}><Input id="w-n" name="title" maxLength={120} /></Field>
        </>
      )}
    </EntryDialog>
  );
}

// ---------- Accounts ----------
export function TransferDialog({ t, businessId, opts }: { t: Dict; businessId: string; opts: Opts }) {
  return (
    <EntryDialog action={A.recordTransfer} businessId={businessId} t={t} title={t.addTransfer} submit={t.addTransfer}
      trigger={<Button variant="outline">{t.addTransfer}</Button>}>
      {() => (
        <>
          <AmountDate t={t} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.fromAccount} htmlFor="t-f"><Select id="t-f" name="account_id" required placeholder={t.account_} options={accountOptions(opts, t)} /></Field>
            <Field label={t.toAccount} htmlFor="t-t"><Select id="t-t" name="to_account_id" required placeholder={t.account_} options={accountOptions(opts, t)} /></Field>
          </div>
          <Field label={t.note} htmlFor="t-n" optional={t.optional}><Input id="t-n" name="title" maxLength={120} /></Field>
        </>
      )}
    </EntryDialog>
  );
}

export function IncomeDialog({ t, businessId, opts }: { t: Dict; businessId: string; opts: Opts }) {
  return (
    <EntryDialog action={A.recordIncome} businessId={businessId} t={t} title={t.addIncome} submit={t.addIncome}
      trigger={<Button variant="outline">{t.addIncome}</Button>}>
      {() => (
        <>
          <AmountDate t={t} />
          <Field label={t.receivedInto} htmlFor="n-a"><Select id="n-a" name="account_id" required placeholder={t.account_} options={accountOptions(opts, t)} /></Field>
          <Field label={t.title} htmlFor="n-t"><Input id="n-t" name="title" required maxLength={120} /></Field>
          <Field label={t.reference} htmlFor="n-r" optional={t.optional}><Input id="n-r" name="reference" maxLength={80} /></Field>
        </>
      )}
    </EntryDialog>
  );
}

export function AccountDialog({ t, businessId }: { t: Dict; businessId: string }) {
  return (
    <EntryDialog action={A.addAccount} businessId={businessId} t={t} title={t.addAccount} submit={t.addAccount}
      trigger={<Button><Plus /> {t.addAccount}</Button>}>
      {() => (
        <>
          <Field label={t.accountName} htmlFor="a-n"><Input id="a-n" name="name" required maxLength={60} placeholder="bKash Merchant" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.accountType} htmlFor="a-t"><Select id="a-t" name="type" defaultValue="bkash" options={Object.entries(t.accountTypes).map(([v, l]) => ({ value: v, label: l }))} /></Field>
            <Field label={`${t.openingBalance} (৳)`} htmlFor="a-o"><Input id="a-o" name="opening_balance" inputMode="decimal" defaultValue="0" className="tabular" /></Field>
          </div>
        </>
      )}
    </EntryDialog>
  );
}

export function CategoryDialog({ t, businessId }: { t: Dict; businessId: string }) {
  return (
    <EntryDialog action={A.addCategory} businessId={businessId} t={t} title={t.addCategory} submit={t.addCategory}
      trigger={<Button variant="outline" size="sm"><Plus /> {t.addCategory}</Button>}>
      {() => (
        <>
          <Field label={t.categoryName} htmlFor="c-n"><Input id="c-n" name="name" required maxLength={60} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_advertising" className="size-4 rounded border-input accent-[var(--brand)]" /> {t.isAdvertising}
          </label>
        </>
      )}
    </EntryDialog>
  );
}


