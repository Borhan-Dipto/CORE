import { Wallet, Landmark, Smartphone, CreditCard } from "lucide-react";
import { Page, Notice } from "@/components/shell/Page";
import { AccountDialog, CategoryDialog, IncomeDialog, TransferDialog } from "@/components/forms/finance";
import { ToggleActive } from "@/components/forms/core";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBizPage } from "@/lib/bizpage";
import { toggleAccount, toggleCategory } from "@/app/actions";
import { fmtMoney } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata = { title: "Accounts" };
const ICON: Record<string, typeof Wallet> = { cash: Wallet, bank: Landmark, gateway: CreditCard };

export default async function AccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadBizPage(id, { range: "all" });
  const { t, lang, accounts, categories } = p;
  const total = accounts.filter((a) => a.is_active).reduce((s, a) => s + a.balance, 0);
  return (
    <Page wide title={t.accounts} description={`${t.balance}: ${fmtMoney(total, lang)}`}
      actions={p.writable && <><IncomeDialog t={t} businessId={id} opts={p.opts} /><TransferDialog t={t} businessId={id} opts={p.opts} /><AccountDialog t={t} businessId={id} /></>}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const I = ICON[a.type] ?? Smartphone;
          return (
            <Card key={a.id} className={cn("p-5", !a.is_active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><I className="size-4" /></div>
                  <div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{t.accountTypes[a.type]}</p></div>
                </div>
                {!a.is_active && <Badge>{t.inactive}</Badge>}
              </div>
              <p className={cn("tabular mt-4 text-2xl font-semibold tracking-tight", a.balance < 0 && "text-destructive")}>{fmtMoney(a.balance, lang)}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                {[[t.openingBalance, a.opening_balance], [t.moneyIn, a.money_in], [t.moneyOut, a.money_out]].map(([l, v]) => (
                  <div key={String(l)} className="min-w-0"><dt className="truncate text-muted-foreground">{l}</dt><dd className="tabular truncate font-medium">{fmtMoney(Number(v), lang, { compact: true })}</dd></div>
                ))}
              </dl>
              {p.writable && <div className="mt-2 -mb-2 flex justify-end">
                <ToggleActive action={toggleAccount.bind(null, a.id, id, !a.is_active)} active={a.is_active} labels={{ on: t.active, off: t.inactive }} />
              </div>}
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div><CardTitle>{t.categories}</CardTitle><CardDescription>{t.expenses}</CardDescription></div>
          {p.writable && <CategoryDialog t={t} businessId={id} />}
        </CardHeader>
        <CardContent className="grid gap-1 pt-3">
          {categories.map((c) => (
            <div key={c.id} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50", !c.is_active && "opacity-60")}>
              <span className="flex-1 truncate text-sm">{c.name}</span>
              {c.is_advertising && <Badge variant="brand">{t.advertising}</Badge>}
              {!c.is_active && <Badge>{t.inactive}</Badge>}
              {p.writable && <ToggleActive action={toggleCategory.bind(null, c.id, id, !c.is_active)} active={c.is_active} labels={{ on: t.active, off: t.inactive }} />}
            </div>
          ))}
        </CardContent>
      </Card>
    </Page>
  );
}
