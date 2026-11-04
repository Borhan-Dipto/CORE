import { Package } from "lucide-react";
import { Page, Notice, EmptyState } from "@/components/shell/Page";
import { ProductDialog, ProductEditButton, ProductToggle } from "@/components/forms/sales";
import { Badge, Card } from "@/components/ui/card";
import { loadBizPage } from "@/lib/bizpage";
import { getOrderSummary, getProducts } from "@/lib/sales";
import { toggleProduct } from "@/app/actions";
import { fmtMoney, fmtNum } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata = { title: "Products" };

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadBizPage(id, { range: "all" });
  const { t, lang } = p;
  const [products, s] = await Promise.all([getProducts(id), getOrderSummary(id, p.range.from, p.range.to)]);
  const stats = new Map(s.by_product.map((x) => [x.key, x]));
  return (
    <Page wide title={t.products} description={t.productHint} actions={p.writable && <ProductDialog t={t} lang={lang} businessId={id} />}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      {products.length === 0 ? (
        <EmptyState icon={Package} title={t.noProducts} action={p.writable ? <ProductDialog t={t} lang={lang} businessId={id} /> : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="h-10 px-4 text-left font-medium">{t.product}</th>
                <th className="px-4 text-right font-medium">{t.costPrice}</th><th className="px-4 text-right font-medium">{t.sellPrice}</th>
                <th className="px-4 text-right font-medium">{t.margin}</th><th className="px-4 text-right font-medium">{t.unitsSold}</th>
                <th className="px-4 text-right font-medium">{t.profitLabel}</th><th className="w-24 px-2"><span className="sr-only">{t.actions}</span></th>
              </tr></thead>
              <tbody>
                {products.map((pr) => {
                  const st = stats.get(pr.id); const m = pr.sell_price ? Math.round(((pr.sell_price - pr.cost_price) / pr.sell_price) * 100) : 0;
                  return (
                    <tr key={pr.id} className={cn("border-b border-border last:border-0 hover:bg-muted/40", !pr.is_active && "opacity-60")}>
                      <td className="px-4 py-3"><p className="font-medium">{pr.name}</p>
                        <p className="text-xs text-muted-foreground">{[pr.sku, pr.category].filter(Boolean).join(" · ")}{!pr.is_active && <Badge className="ml-2">{t.inactive}</Badge>}</p></td>
                      <td className="tabular px-4 text-right">{fmtMoney(pr.cost_price, lang)}</td>
                      <td className="tabular px-4 text-right">{fmtMoney(pr.sell_price, lang)}</td>
                      <td className={cn("tabular px-4 text-right", m < 20 ? "text-warning" : "text-success")}>{fmtNum(m, lang)}%</td>
                      <td className="tabular px-4 text-right">{fmtNum(st?.units ?? 0, lang)}</td>
                      <td className="tabular px-4 text-right font-medium">{fmtMoney(st?.profit ?? 0, lang)}</td>
                      <td className="px-2 text-right whitespace-nowrap">{p.writable && <>
                        <ProductEditButton t={t} lang={lang} businessId={id} product={pr} />
                        <ProductToggle action={toggleProduct.bind(null, pr.id, id, !pr.is_active)} active={pr.is_active} labels={{ on: t.active, off: t.inactive }} />
                      </>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
