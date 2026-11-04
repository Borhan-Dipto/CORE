import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import type { CampaignRow } from "@/lib/campaignPerf";
import { cn } from "@/lib/utils";

export function CampaignTable({ rows, t, lang }: { rows: CampaignRow[]; t: Dict; lang: Lang }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader><CardTitle>{t.campaignPerf}</CardTitle><CardDescription>{t.campaignPerfDesc}</CardDescription></CardHeader>
      {rows.length === 0 ? <p className="px-5 pt-4 pb-6 text-sm text-muted-foreground">{t.noAds}</p> : (
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-y border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="h-10 px-5 text-left font-medium">{t.campaign}</th><th className="px-4 text-right font-medium">{t.spend}</th>
              <th className="px-4 text-right font-medium">{t.orders}</th><th className="px-4 text-right font-medium">{t.revenue}</th>
              <th className="px-4 text-right font-medium">{t.kpiRoas}</th><th className="px-5 text-right font-medium">{t.netProfit}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.campaign} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium">{r.campaign}</td>
                  <td className="tabular px-4 text-right">{fmtMoney(r.spend, lang)}</td>
                  <td className="tabular px-4 text-right">{fmtNum(r.orders, lang)}</td>
                  <td className="tabular px-4 text-right">{fmtMoney(r.revenue, lang)}</td>
                  <td className="px-4 text-right">{r.roas === null ? "—" : <Badge variant={r.roas >= 3 ? "success" : r.roas >= 1.5 ? "warning" : "destructive"}>{fmtNum(r.roas, lang, 1)}×</Badge>}</td>
                  <td className={cn("tabular px-5 text-right font-medium", r.net >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(r.net, lang, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
