// Shared (client + server): turns a stored notification into words, in the reader's language.
type P = Record<string, unknown>;
export type NotifLang = "bn" | "en";

const money = (v: unknown, lang: NotifLang) =>
  "৳" + new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 2 }).format(Math.abs(Number(v ?? 0)));
const day = (v: unknown, lang: NotifLang) =>
  v ? new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(new Date(String(v) + "T00:00:00+06:00")) : "";
const s = (v: unknown) => (v == null ? "" : String(v));

export function notificationText(kind: string, p: P, lang: NotifLang): { title: string; body: string } {
  const bn = lang === "bn";
  const who = s(p.actor) || (bn ? "মালিক" : "The owner");
  const amt = money(p.amount, lang);
  const biz = s(p.business);
  switch (kind) {
    case "expense": {
      const ad = p.ad === true;
      const what = s(p.title) || s(p.category);
      return {
        title: bn ? `${ad ? "নতুন বুস্টিং খরচ" : "নতুন খরচ"} · ${amt}` : `${ad ? "New ad spend" : "New expense"} · ${amt}`,
        body: bn
          ? `${who} ${biz}-এ ${amt} ${ad ? "বুস্টিং" : "খরচ"} লিখেছেন${what ? ` — ${what}` : ""}${p.campaign ? ` (${s(p.campaign)})` : ""}${p.partner ? `। পরিশোধ করেছেন ${s(p.partner)}` : ""}।`
          : `${who} recorded ${amt} ${ad ? "ad spend" : "expense"} in ${biz}${what ? ` — ${what}` : ""}${p.campaign ? ` (${s(p.campaign)})` : ""}${p.partner ? `, paid by ${s(p.partner)}` : ""}.`,
      };
    }
    case "investment":
      return {
        title: bn ? `ইনভেস্টমেন্ট · ${amt}` : `Investment · ${amt}`,
        body: bn ? `${s(p.partner) || who} ${biz}-এ ${amt} বিনিয়োগ করেছেন (${day(p.date, lang)})।` : `${s(p.partner) || who} invested ${amt} in ${biz} (${day(p.date, lang)}).`,
      };
    case "withdrawal":
      return {
        title: bn ? `টাকা তোলা · ${amt}` : `Withdrawal · ${amt}`,
        body: bn ? `${s(p.partner) || who} ${biz} থেকে ${amt} তুলেছেন (${day(p.date, lang)})।` : `${s(p.partner) || who} withdrew ${amt} from ${biz} (${day(p.date, lang)}).`,
      };
    case "payout":
      return {
        title: bn ? `লাভের টাকা দেওয়া হয়েছে · ${amt}` : `Profit paid · ${amt}`,
        body: bn ? `${s(p.partner)}-কে ${biz}-এর লাভের ভাগ থেকে ${amt} দেওয়া হয়েছে।` : `${s(p.partner)} was paid ${amt} from their ${biz} profit share.`,
      };
    case "reversal":
      return {
        title: bn ? `এন্ট্রি বাতিল · ${amt}` : `Entry reversed · ${amt}`,
        body: bn ? `${who} ${biz}-এর একটি ${amt} এন্ট্রি বাতিল করেছেন${p.reason ? ` — কারণ: ${s(p.reason)}` : ""}।` : `${who} reversed a ${amt} entry in ${biz}${p.reason ? ` — reason: ${s(p.reason)}` : ""}.`,
      };
    case "settlement": {
      const period = `${day(p.from, lang)} – ${day(p.to, lang)}`;
      const mine = p.my_share != null ? (bn ? ` আপনার ভাগ ${money(p.my_share, lang)}।` : ` Your share: ${money(p.my_share, lang)}.`) : "";
      return Number(p.amount ?? 0) > 0
        ? { title: bn ? `লাভ বণ্টন · ${amt}` : `Profit distributed · ${amt}`,
            body: bn ? `${biz}-এর ${period} সময়ের হিসাব ক্লোজ হয়েছে। মোট ${amt} লাভ ভাগ হয়েছে।${mine}` : `${biz} closed ${period}. ${amt} profit was distributed.${mine}` }
        : { title: bn ? `সময়কাল ক্লোজ · লোকসান` : `Period closed · loss`,
            body: bn ? `${biz}-এর ${period} সময়ে লোকসান হয়েছে (${money(p.net_profit, lang)})। এটা পরের লাভ থেকে পূরণ হবে।` : `${biz} closed ${period} at a loss (${money(p.net_profit, lang)}). It will be recovered from later profits.` };
    }
    case "settlement_void":
      return {
        title: bn ? "লাভ বণ্টন বাতিল" : "Profit distribution undone",
        body: bn ? `${biz}-এর ${day(p.from, lang)} – ${day(p.to, lang)} সময়ের বণ্টন বাতিল হয়েছে${p.reason ? ` — কারণ: ${s(p.reason)}` : ""}।` : `${biz}'s distribution for ${day(p.from, lang)} – ${day(p.to, lang)} was undone${p.reason ? ` — reason: ${s(p.reason)}` : ""}.`,
      };
    case "weekly": {
      const net = Number(p.net_profit ?? 0);
      return {
        title: bn ? `সাপ্তাহিক সারাংশ · ${biz}` : `Weekly summary · ${biz}`,
        body: bn
          ? `${day(p.from, lang)} – ${day(p.to, lang)}: অর্ডার ${new Intl.NumberFormat("bn-BD").format(Number(p.orders ?? 0))}টি, বিক্রি ${money(p.revenue, lang)}, বুস্টিং ${money(p.ad_spend, lang)}, নিট ${net < 0 ? "লোকসান" : "লাভ"} ${money(net, lang)}।`
          : `${day(p.from, lang)} – ${day(p.to, lang)}: ${Number(p.orders ?? 0)} orders, revenue ${money(p.revenue, lang)}, ad spend ${money(p.ad_spend, lang)}, net ${net < 0 ? "loss" : "profit"} ${money(net, lang)}.`,
      };
    }
    case "test":
      return { title: bn ? "CORE থেকে পরীক্ষামূলক ইমেইল" : "Test email from CORE",
               body: bn ? "এই ইমেইলটা পেয়ে থাকলে CORE-এর ইমেইল নোটিফিকেশন ঠিকঠাক কাজ করছে।" : "If you received this, CORE email notifications are working." };
    default:
      return { title: biz, body: "" };
  }
}
