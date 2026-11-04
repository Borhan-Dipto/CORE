import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { docNo, invoiceNo } from "./numbers";
import type { Brand, DocData, DocLang, Txn } from "./load";

// ---------- Labels ----------
const L = {
  en: {
    invoice: "Invoice", paymentVoucher: "Payment Voucher", moneyReceipt: "Money Receipt", withdrawalVoucher: "Withdrawal Voucher",
    transferVoucher: "Fund Transfer Voucher", statement: "Partner Capital Statement",
    no: "No.", date: "Date", status: "Status", billTo: "Bill to", orderDetails: "Order details", orderNo: "Order no.", orderDate: "Order date",
    delivered: "Delivered", courier: "Courier", tracking: "Tracking no.", payment: "Payment", item: "Item", qty: "Qty", unitPrice: "Unit price", amount: "Amount",
    subtotal: "Subtotal", discount: "Discount", delivery: "Delivery charge", total: "Total", paid: "Paid", due: "Balance due",
    inWords: "In words", paymentInfo: "Payment information", terms: "Terms & policy", customerSig: "Customer signature", authSig: "Authorized signature",
    preparedBy: "Prepared by", approvedBy: "Approved by", receivedBy: "Received by", partnerSig: "Partner signature",
    paidTo: "Paid to / purpose", category: "Category", paidFrom: "Paid from", paidPersonally: "Paid personally by", receivedFrom: "Received from",
    depositedTo: "Deposited to", purpose: "Purpose", capitalInvestment: "Capital investment", withdrawnBy: "Withdrawn by", fromAccount: "From account",
    toAccount: "To account", adPlatform: "Ad platform", campaign: "Campaign", product: "Product", description: "Description", reference: "Reference",
    orderCollection: "Customer payment collected for order", reversalOf: "Reversal of", reason: "Reason", partner: "Partner", email: "Email",
    profitShare: "Current profit share", period: "Period", allTime: "Since start", upTo: "up to", totalInvested: "Total invested",
    totalWithdrawn: "Total withdrawn", netCapital: "Net capital balance", ref: "Ref.", type: "Type", investment: "Investment", withdrawal: "Withdrawal",
    balance: "Balance", openingBalance: "Opening balance", noEntries: "No capital entries in this period.",
    stamp: { paid: "PAID", due: "DUE", cod: "CASH ON DELIVERY", cancelled: "CANCELLED", returned: "RETURNED", void: "VOID", reversal: "REVERSAL" },
    statusText: { paid: "Paid", due: "Due", cancelled: "Cancelled", returned: "Returned", void: "Reversed", posted: "Posted", reversal: "Reversal entry", final: "Final" },
    computer: "This is a computer-generated document.", generated: "Generated",
    print: "Print", download: "Download PDF", other: "বাংলা",
    creditNoteTitle: "Profit Share Credit Note", creditedTo: "Credited to", creditedAs: "Credited as", creditedAsText: "Partner capital (profit share)",
    settlementTitle: "Profit Distribution Statement", settlementNo: "Settlement no.", revenue: "Revenue (delivered orders)", cogs: "Cost of goods",
    directCosts: "Delivery & order costs", grossProfit: "Gross profit", opex: "Operating expenses", otherIncome: "Other income",
    netProfit: "Net profit for the period", carriedLoss: "Loss brought forward", distributable: "Profit distributed", carryOut: "Loss carried forward",
    shareCol: "Share", paidCol: "Paid out", retainedCol: "Retained in business", totalInvestedShort: "Invested", profitCredited: "Profit credited",
    lossNote: "This period made a loss. No profit is distributed; the loss is recovered from future profits first.",
    voidNote: "This settlement was undone and all its entries reversed.", profitShareRow: "Profit share", preparedOn: "Prepared",
  },
  bn: {
    invoice: "ইনভয়েস", paymentVoucher: "পেমেন্ট ভাউচার", moneyReceipt: "মানি রিসিট", withdrawalVoucher: "উত্তোলন ভাউচার",
    transferVoucher: "ফান্ড ট্রান্সফার ভাউচার", statement: "পার্টনার মূলধন বিবরণী",
    no: "নং", date: "তারিখ", status: "অবস্থা", billTo: "ক্রেতা", orderDetails: "অর্ডারের তথ্য", orderNo: "অর্ডার নং", orderDate: "অর্ডারের তারিখ",
    delivered: "ডেলিভারি", courier: "কুরিয়ার", tracking: "ট্র্যাকিং নং", payment: "পেমেন্ট", item: "পণ্য", qty: "পরিমাণ", unitPrice: "একক মূল্য", amount: "মোট",
    subtotal: "সাবটোটাল", discount: "ডিসকাউন্ট", delivery: "ডেলিভারি চার্জ", total: "সর্বমোট", paid: "পরিশোধিত", due: "বাকি",
    inWords: "কথায়", paymentInfo: "পেমেন্টের তথ্য", terms: "শর্তাবলি ও নীতি", customerSig: "ক্রেতার স্বাক্ষর", authSig: "অনুমোদনকারীর স্বাক্ষর",
    preparedBy: "প্রস্তুতকারী", approvedBy: "অনুমোদনকারী", receivedBy: "গ্রহীতা", partnerSig: "পার্টনারের স্বাক্ষর",
    paidTo: "যাকে / যে কারণে", category: "খাত", paidFrom: "যে অ্যাকাউন্ট থেকে", paidPersonally: "নিজে পরিশোধ করেছেন", receivedFrom: "যার থেকে গৃহীত",
    depositedTo: "যে অ্যাকাউন্টে জমা", purpose: "উদ্দেশ্য", capitalInvestment: "মূলধন বিনিয়োগ", withdrawnBy: "উত্তোলনকারী", fromAccount: "যে অ্যাকাউন্ট থেকে",
    toAccount: "যে অ্যাকাউন্টে", adPlatform: "বিজ্ঞাপন প্ল্যাটফর্ম", campaign: "ক্যাম্পেইন", product: "পণ্য", description: "বিবরণ", reference: "রেফারেন্স",
    orderCollection: "অর্ডারের পেমেন্ট সংগ্রহ", reversalOf: "যে এন্ট্রি বাতিল", reason: "কারণ", partner: "পার্টনার", email: "ইমেইল",
    profitShare: "বর্তমান লাভের অংশ", period: "সময়কাল", allTime: "শুরু থেকে", upTo: "পর্যন্ত", totalInvested: "মোট বিনিয়োগ",
    totalWithdrawn: "মোট উত্তোলন", netCapital: "নিট মূলধন", ref: "রেফ.", type: "ধরন", investment: "বিনিয়োগ", withdrawal: "উত্তোলন",
    balance: "ব্যালেন্স", openingBalance: "প্রারম্ভিক ব্যালেন্স", noEntries: "এই সময়ে কোনো মূলধন এন্ট্রি নেই।",
    stamp: { paid: "পরিশোধিত", due: "বাকি", cod: "ক্যাশ অন ডেলিভারি", cancelled: "বাতিল", returned: "রিটার্ন", void: "বাতিল", reversal: "রিভার্সাল" },
    statusText: { paid: "পরিশোধিত", due: "বাকি", cancelled: "বাতিল", returned: "রিটার্ন", void: "বাতিল করা হয়েছে", posted: "পোস্টেড", reversal: "বাতিলের এন্ট্রি", final: "চূড়ান্ত" },
    computer: "এটি কম্পিউটারে তৈরি একটি ডকুমেন্ট।", generated: "তৈরি",
    print: "প্রিন্ট", download: "PDF ডাউনলোড", other: "English",
    creditNoteTitle: "লাভের ভাগ জমা নোট", creditedTo: "যার নামে জমা", creditedAs: "জমার ধরন", creditedAsText: "পার্টনারের মূলধন (লাভের ভাগ)",
    settlementTitle: "লাভ বণ্টন বিবরণী", settlementNo: "সেটেলমেন্ট নং", revenue: "বিক্রি (ডেলিভারড অর্ডার)", cogs: "পণ্যের খরচ",
    directCosts: "ডেলিভারি ও অর্ডারের খরচ", grossProfit: "মোট লাভ", opex: "পরিচালন খরচ", otherIncome: "অন্যান্য আয়",
    netProfit: "এই সময়ের নিট লাভ", carriedLoss: "আগের লোকসান", distributable: "বণ্টিত লাভ", carryOut: "পরের সময়ে যাওয়া লোকসান",
    shareCol: "ভাগ", paidCol: "দেওয়া হয়েছে", retainedCol: "ব্যবসায় রাখা", totalInvestedShort: "বিনিয়োগ", profitCredited: "লাভ জমা",
    lossNote: "এই সময়ে লোকসান হয়েছে। কোনো লাভ বণ্টন হয়নি; পরের লাভ থেকে আগে এই লোকসান পূরণ হবে।",
    voidNote: "এই সেটেলমেন্ট বাতিল করা হয়েছে এবং এর সব এন্ট্রি উল্টে দেওয়া হয়েছে।", profitShareRow: "লাভের ভাগ", preparedOn: "প্রস্তুত",
  },
};
type Lx = (typeof L)["en"];

// ---------- Formatting ----------
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const lines = (v: string | null) => esc(v).replace(/\r?\n/g, "<br>");
const loc = (lang: DocLang) => (lang === "bn" ? "bn-BD" : "en-GB");
const money = (n: number, lang: DocLang) =>
  "৳" + new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
const date = (iso: string | null, lang: DocLang) =>
  iso ? new Intl.DateTimeFormat(loc(lang), { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso.length === 10 ? iso + "T00:00:00+06:00" : iso)) : "—";
const num = (n: number, lang: DocLang) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN").format(n);

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? ONES[h] + " hundred" : "", rest].filter(Boolean).join(" ");
}
/** South-Asian system: crore, lakh, thousand. */
export function inWordsEn(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - n) * 100);
  if (n === 0 && !paisa) return "Zero taka only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push((crore >= 1000 ? inWordsEn(crore).replace(/ taka only$/i, "").toLowerCase() : below1000(crore)) + " crore");
  if (lakh) parts.push(below1000(lakh) + " lakh");
  if (thousand) parts.push(below1000(thousand) + " thousand");
  if (n) parts.push(below1000(n));
  let s = parts.join(" ") + " taka";
  if (paisa) s += " and " + below1000(paisa) + " paisa";
  s += " only";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Fonts (bundled, so PDFs never depend on the network) ----------
let fontCss: string | null = null;
function fonts() {
  if (fontCss) return fontCss;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const face = (family: string, file: string, weight: number, range: string) => {
    try {
      const b64 = readFileSync(path.join(dir, file)).toString("base64");
      return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`;
    } catch { return ""; }
  };
  const latin = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  const bengali = "U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1";
  fontCss = [400, 600, 700].map((w) => face("DocSans", `inter-${w}.woff2`, w, latin) + face("DocSans", `bn-${w}.woff2`, w, bengali + ",U+09F3")).join("");
  return fontCss;
}

// ---------- Styles ----------
const CSS = `
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'DocSans',system-ui,sans-serif;color:#0a0a0a;font-size:10.5pt;line-height:1.5;background:#fff}
.r,.totals,.amountbox .v,.summary .v,.meta{font-variant-numeric:tabular-nums}
.doc{position:relative}
.bar{height:4px;background:#0a0a0a;border-radius:2px;margin-bottom:18px;position:relative;overflow:hidden}
.bar:after{content:'';position:absolute;right:0;top:0;bottom:0;width:28%;background:#2563eb}
.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.brand{display:flex;gap:14px;align-items:flex-start;min-width:0}
.logo{max-height:60px;max-width:150px;object-fit:contain}
.mono{width:52px;height:52px;border-radius:12px;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20pt;flex:none}
.bname{font-size:16pt;font-weight:700;letter-spacing:-.01em;line-height:1.2}
.tag{color:#6b7280;font-size:9pt;margin-top:1px}
.contact{color:#4b5563;font-size:8.5pt;margin-top:6px;line-height:1.55}
.title{text-align:right;flex:none}
.title h1{font-size:20pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.1}
.title.bn h1{letter-spacing:0}
.meta{margin-top:10px;border-collapse:collapse;margin-left:auto;font-size:9pt}
.meta td{padding:2px 0}
.meta td:first-child{color:#6b7280;padding-right:14px;text-align:right}
.meta td:last-child{font-weight:600;text-align:right}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:8.5pt;font-weight:600}
.pill.ok{background:#dcfce7;color:#166534}.pill.warn{background:#fef3c7;color:#92400e}.pill.bad{background:#fee2e2;color:#991b1b}.pill.muted{background:#f3f4f6;color:#374151}
.rule{height:1px;background:#e5e7eb;margin:18px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.box{border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px}
.lbl{font-size:7.5pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.bn .lbl,.lbl.bn{letter-spacing:0;font-size:8.5pt}
.strong{font-weight:600;font-size:11pt}
.muted{color:#6b7280}
.kv{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:9.5pt}
.kv dt{color:#6b7280}.kv dd{font-weight:500;text-align:right}
table.items{width:100%;border-collapse:separate;border-spacing:0;margin-top:18px;font-size:9.5pt}
table.items th{background:#f9fafb;color:#4b5563;font-weight:600;font-size:8.5pt;text-align:left;padding:8px 10px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
table.items th:first-child{border-left:1px solid #e5e7eb;border-radius:8px 0 0 0}
table.items th:last-child{border-right:1px solid #e5e7eb;border-radius:0 8px 0 0}
table.items td{padding:9px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
table.items tr{break-inside:avoid}
table.items th.r{text-align:right}table.items th.c{text-align:center}
.r{text-align:right;white-space:nowrap}.c{text-align:center}
.idx{color:#9ca3af;width:28px}
.sub{color:#6b7280;font-size:8.5pt}
.after{display:flex;justify-content:space-between;gap:24px;margin-top:14px;align-items:flex-start;break-inside:avoid}
.words{flex:1;padding-top:6px;font-size:9pt}
.totals{width:270px;border-collapse:collapse;font-size:9.5pt;flex:none}
.totals td{padding:4px 0}.totals td:last-child{text-align:right;font-weight:500}
.totals .grand td{border-top:1.5px solid #0a0a0a;padding-top:8px;font-size:12pt;font-weight:700}
.totals .due td{color:#1d4ed8;font-weight:700}
.stampwrap{position:relative;height:0}
.stamp{position:absolute;right:300px;top:-6px;transform:rotate(-10deg);border:2.5px solid currentColor;border-radius:8px;padding:5px 16px;font-weight:700;font-size:17pt;letter-spacing:.12em;opacity:.8;white-space:nowrap}
.stamp.bn{letter-spacing:0}
.stamp.ok{color:#16a34a}.stamp.due{color:#dc2626}.stamp.muted{color:#6b7280}
.amountbox{display:flex;justify-content:space-between;align-items:center;border:1.5px solid #0a0a0a;border-radius:12px;padding:14px 18px;margin-top:16px;break-inside:avoid}
.amountbox .v{font-size:20pt;font-weight:700;letter-spacing:-.01em}
.details{width:100%;border-collapse:collapse;margin-top:16px;font-size:10pt}
.details td{padding:9px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}
.details td:first-child{color:#6b7280;width:38%;padding-right:16px}
.details td:last-child{font-weight:500}
.foot{margin-top:22px;break-inside:avoid}
.notes{display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:8.5pt;color:#374151}
.notes.one{grid-template-columns:1fr}
.thanks{text-align:center;margin-top:18px;font-size:10.5pt;font-weight:600}
.sigs{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;margin-top:46px}
.sig{flex:1;max-width:210px;text-align:center;font-size:8.5pt;color:#4b5563}
.sig .line{border-top:1px solid #9ca3af;padding-top:6px}
.sig .who{color:#0a0a0a;font-weight:600;font-size:9pt;margin-bottom:4px;min-height:14px;line-height:1.35}
.fine{margin-top:20px;text-align:center;font-size:7.5pt;color:#9ca3af}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
.summary.four{grid-template-columns:repeat(4,1fr)}
.summary .v{font-size:14pt;font-weight:700;margin-top:2px}
.neg{color:#b91c1c}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:8px;padding:10px;background:rgba(244,244,245,.9);backdrop-filter:blur(8px);border-bottom:1px solid #e4e4e7;font-family:'DocSans',system-ui,sans-serif}
.toolbar a,.toolbar button{font:inherit;font-size:13px;font-weight:500;padding:7px 14px;border-radius:8px;border:1px solid #d4d4d8;background:#fff;color:#0a0a0a;text-decoration:none;cursor:pointer}
.toolbar .primary{background:#0a0a0a;color:#fff;border-color:#0a0a0a}
@media screen{html{background:#f4f4f5}.sheet{width:210mm;min-height:297mm;margin:24px auto;background:#fff;padding:14mm;box-shadow:0 1px 3px rgba(0,0,0,.08),0 12px 40px rgba(0,0,0,.08);border-radius:4px}}
@media screen and (max-width:820px){.sheet{width:auto;margin:0;padding:16px;min-height:0;border-radius:0}.head{flex-direction:column}.title{text-align:left}.meta{margin-left:0}.grid2,.notes,.summary{grid-template-columns:1fr}.after{flex-direction:column}.totals{width:100%}.stamp{right:auto;left:0;top:-40px}}
@media print{.toolbar{display:none}}
`;

// ---------- Building blocks ----------
function header(b: Brand, title: string, meta: [string, string][], lang: DocLang) {
  const initial = esc((b.name.trim()[0] ?? "C").toUpperCase());
  const contact = [b.address ? lines(b.address) : "", [b.phone, b.email].filter(Boolean).map(esc).join(" · "), b.website ? esc(b.website) : ""].filter(Boolean).join("<br>");
  return `<div class="bar"></div><div class="head">
  <div class="brand">${b.logo ? `<img class="logo" src="${esc(b.logo)}" alt="">` : `<div class="mono">${initial}</div>`}
    <div><div class="bname">${esc(b.name)}</div>${b.tagline ? `<div class="tag">${esc(b.tagline)}</div>` : ""}${contact ? `<div class="contact">${contact}</div>` : ""}</div></div>
  <div class="title ${lang}"><h1>${esc(title)}</h1><table class="meta">${meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table></div>
</div>`;
}
const pill = (text: string, tone: "ok" | "warn" | "bad" | "muted") => `<span class="pill ${tone}">${esc(text)}</span>`;
const sigs = (items: { label: string; who?: string | null }[]) =>
  `<div class="sigs">${items.map((s) => `<div class="sig"><div class="who">${esc(s.who ?? "")}</div><div class="line">${esc(s.label)}</div></div>`).join("")}</div>`;
function notes(b: Brand, t: Lx, lang: DocLang, opts: { payment?: boolean; policy?: boolean }) {
  const blocks = [
    opts.payment && b.payment_info ? `<div class="box"><div class="lbl ${lang}">${esc(t.paymentInfo)}</div>${lines(b.payment_info)}</div>` : "",
    opts.policy && b.policy_note ? `<div class="box"><div class="lbl ${lang}">${esc(t.terms)}</div>${lines(b.policy_note)}</div>` : "",
  ].filter(Boolean);
  return blocks.length ? `<div class="notes ${blocks.length === 1 ? "one" : ""}">${blocks.join("")}</div>` : "";
}
const fine = (t: Lx, lang: DocLang) => `<div class="fine">${esc(t.computer)} · ${esc(t.generated)} ${esc(date(new Date().toISOString(), lang))} · CORE</div>`;

// ---------- Documents ----------
function invoiceBody(d: Extract<DocData, { kind: "invoice" }>, lang: DocLang, t: Lx) {
  const o = d.order;
  const subtotal = o.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const closed = o.status === "cancelled" || o.status === "returned";
  const paid = o.collected ? Number(o.collected_amount ?? o.net_sales) : 0;
  const balance = closed ? 0 : Math.max(o.net_sales - paid, 0);
  const state = closed ? (o.status as "cancelled" | "returned") : o.collected ? "paid" : "due";
  const tone = state === "paid" ? "ok" : state === "due" ? "warn" : "muted";
  const stampText = state === "due" && o.status !== "delivered" ? t.stamp.cod : t.stamp[state];
  const stampTone = state === "paid" ? "ok" : state === "due" ? "due" : "muted";
  const meta: [string, string][] = [
    [t.no, `<strong>${esc(invoiceNo(o.order_no))}</strong>`], [t.date, esc(date(o.delivered_on ?? o.order_date, lang))],
    [t.status, pill(t.statusText[state], tone)],
  ];
  const right: [string, string][] = [
    [t.orderNo, esc(o.order_no)], [t.orderDate, esc(date(o.order_date, lang))],
    ...(o.delivered_on ? [[t.delivered, esc(date(o.delivered_on, lang))] as [string, string]] : []),
    ...(o.courier ? [[t.courier, esc(o.courier)] as [string, string]] : []),
    ...(o.tracking_no ? [[t.tracking, esc(o.tracking_no)] as [string, string]] : []),
  ];
  const totals: [string, string, string?][] = [
    [t.subtotal, money(subtotal, lang)],
    ...(o.discount ? [[t.discount, "−" + money(o.discount, lang)] as [string, string]] : []),
    ...(o.delivery_charge ? [[t.delivery, money(o.delivery_charge, lang)] as [string, string]] : []),
    [t.total, money(o.net_sales, lang), "grand"],
    ...(!closed ? [[t.paid, money(paid, lang)] as [string, string], [t.due, money(balance, lang), "due"] as [string, string, string]] : []),
  ];
  return `${header(d.brand, t.invoice, meta, lang)}
<div class="rule"></div>
<div class="grid2 ${lang}">
  <div class="box"><div class="lbl">${esc(t.billTo)}</div>
    <div class="strong">${esc(o.customer_name || "—")}</div>
    ${o.customer_phone ? `<div>${esc(o.customer_phone)}</div>` : ""}
    ${o.customer_address ? `<div class="muted">${lines(o.customer_address)}</div>` : ""}</div>
  <div class="box"><div class="lbl">${esc(t.orderDetails)}</div><dl class="kv">${right.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl></div>
</div>
<table class="items"><thead><tr><th class="idx">#</th><th>${esc(t.item)}</th><th class="c">${esc(t.qty)}</th><th class="r">${esc(t.unitPrice)}</th><th class="r">${esc(t.amount)}</th></tr></thead>
<tbody>${o.items.map((i, n) => `<tr><td class="idx">${num(n + 1, lang)}</td><td>${esc(i.product_name)}</td><td class="c">${num(i.qty, lang)}</td><td class="r">${money(i.unit_price, lang)}</td><td class="r">${money(i.qty * i.unit_price, lang)}</td></tr>`).join("")}</tbody></table>
<div class="stampwrap"><div class="stamp ${stampTone} ${lang}">${esc(stampText)}</div></div>
<div class="after">
  <div class="words">${lang === "en" ? `<div class="lbl">${esc(t.inWords)}</div><div>${esc(inWordsEn(o.net_sales))}</div>` : ""}</div>
  <table class="totals">${totals.map(([k, v, c]) => `<tr class="${c ?? ""}"><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>
</div>
<div class="foot">${notes(d.brand, t, lang, { payment: true, policy: true })}
${d.brand.thank_you ? `<div class="thanks">${lines(d.brand.thank_you)}</div>` : ""}
${sigs([{ label: t.customerSig }, { label: t.authSig, who: d.brand.signatory }])}
${fine(t, lang)}</div>`;
}

function voucherTitle(x: Txn, t: Lx) {
  if (x.txn_type === "profit_share") return t.creditNoteTitle;
  return x.txn_type === "expense" ? t.paymentVoucher : x.txn_type === "withdrawal" ? t.withdrawalVoucher : x.txn_type === "transfer" ? t.transferVoucher : t.moneyReceipt;
}
function voucherBody(d: Extract<DocData, { kind: "voucher" }>, lang: DocLang, t: Lx) {
  const x = d.txn;
  const no = docNo(x.txn_type, x.doc_no);
  const reversal = !!x.reversal_of;
  const voided = x.status === "reversed";
  const state = reversal ? "reversal" : voided ? "void" : "posted";
  const rows: [string, string | null][] = [];
  const add = (k: string, v: string | null | undefined) => { if (v) rows.push([k, esc(v)]); };
  if (reversal) add(t.reversalOf, x.reversal_of_no);
  switch (x.txn_type) {
    case "expense":
      add(t.paidTo, x.title); add(t.category, x.category_name);
      if (x.partner) add(t.paidPersonally, x.partner); else add(t.paidFrom, x.account);
      if (x.is_advertising) { add(t.adPlatform, x.ad_platform ? x.ad_platform[0].toUpperCase() + x.ad_platform.slice(1) : null); add(t.campaign, x.campaign_name); add(t.product, x.target_product); }
      break;
    case "investment":
      add(t.receivedFrom, x.partner); add(t.depositedTo, x.account);
      add(t.purpose, x.linked_txn_id ? `${t.capitalInvestment} — ${x.category_name ?? x.title ?? ""}` : x.title || t.capitalInvestment);
      break;
    case "income":
      add(t.receivedFrom, x.title); add(t.depositedTo, x.account); add(t.category, x.category_name);
      if (x.order_no) add(t.purpose, `${t.orderCollection} ${x.order_no}`);
      break;
    case "withdrawal":
      add(t.withdrawnBy, x.partner); add(t.fromAccount, x.account); add(t.purpose, x.title);
      break;
    case "transfer":
      add(t.fromAccount, x.account); add(t.toAccount, x.to_account); add(t.purpose, x.title);
      break;
    case "profit_share":
      add(t.creditedTo, x.partner); add(t.creditedAs, t.creditedAsText); add(t.purpose, x.title);
      break;
  }
  add(t.description, x.description); add(t.reference, x.reference);
  if (x.reversal_reason) add(t.reason, x.reversal_reason);
  const meta: [string, string][] = [[t.no, `<strong>${esc(no)}</strong>`], [t.date, esc(date(x.txn_date, lang))],
    [t.status, pill(t.statusText[state], state === "posted" ? "ok" : "bad")]];
  const who = x.txn_type === "expense" ? null : x.partner;
  const sigList = x.txn_type === "profit_share"
    ? [{ label: t.preparedBy, who: x.created_by_name }, { label: t.authSig, who: d.brand.signatory }]
    : x.txn_type === "investment" || x.txn_type === "income"
    ? [{ label: t.preparedBy, who: x.created_by_name }, { label: t.receivedBy, who: d.brand.signatory }]
    : [{ label: t.preparedBy, who: x.created_by_name }, { label: t.approvedBy, who: d.brand.signatory }, { label: t.receivedBy, who }];
  return `${header(d.brand, voucherTitle(x, t), meta, lang)}
<div class="rule"></div>
<div class="amountbox"><div><div class="lbl ${lang}">${esc(t.amount)}</div>${lang === "en" ? `<div class="sub">${esc(inWordsEn(x.amount))}</div>` : ""}</div><div class="v">${reversal ? "−" : ""}${money(x.amount, lang)}</div></div>
${voided || reversal ? `<div class="stampwrap"><div class="stamp due ${lang}" style="right:20px;top:20px">${esc(reversal ? t.stamp.reversal : t.stamp.void)}</div></div>` : ""}
<table class="details">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>
<div class="foot">${sigs(sigList)}${fine(t, lang)}</div>`;
}

function statementBody(d: Extract<DocData, { kind: "statement" }>, lang: DocLang, t: Lx) {
  const period = d.from ? `${date(d.from, lang)} — ${date(d.to, lang)}` : `${t.allTime} — ${date(d.to, lang)}`;
  const meta: [string, string][] = [[t.date, esc(date(d.to, lang))], [t.period, esc(d.from ? `${date(d.from, lang)} –` : t.allTime)]];
  const sum = (k: string, v: number, cls = "") => `<div class="box"><div class="lbl ${lang}">${esc(k)}</div><div class="v ${cls}">${v < 0 ? "−" : ""}${money(v, lang)}</div></div>`;
  return `${header(d.brand, t.statement, meta, lang)}
<div class="rule"></div>
<div class="grid2 ${lang}">
  <div class="box"><div class="lbl">${esc(t.partner)}</div><div class="strong">${esc(d.partner.name)}</div>${d.partner.email ? `<div class="muted">${esc(d.partner.email)}</div>` : ""}</div>
  <div class="box"><dl class="kv"><dt>${esc(t.period)}</dt><dd>${esc(period)}</dd>
    ${d.partner.share !== null ? `<dt>${esc(t.profitShare)}</dt><dd>${num(d.partner.share, lang)}%</dd>` : ""}</dl></div>
</div>
<div class="summary${d.totals.profit ? " four" : ""}">${sum(t.totalInvested, d.totals.invested)}${d.totals.profit ? sum(t.profitCredited, d.totals.profit) : ""}${sum(t.totalWithdrawn, d.totals.withdrawn)}${sum(t.netCapital, d.totals.balance, d.totals.balance < 0 ? "neg" : "")}</div>
<table class="items"><thead><tr><th>${esc(t.date)}</th><th>${esc(t.ref)}</th><th>${esc(t.description)}</th><th class="r">${esc(t.investment)}</th><th class="r">${esc(t.withdrawal)}</th><th class="r">${esc(t.balance)}</th></tr></thead>
<tbody>${d.rows.length ? d.rows.map((r) => r.type === "opening"
    ? `<tr><td>${esc(date(r.date, lang))}</td><td></td><td class="muted">${esc(t.openingBalance)}</td><td></td><td></td><td class="r"><strong>${money(r.balance, lang)}</strong></td></tr>`
    : `<tr><td>${esc(date(r.date, lang))}</td><td class="sub">${esc(r.no)}</td><td>${esc(r.type === "profit_share" ? `${t.profitShareRow}${r.note ? " · " + r.note.replace(/^Profit share\s*/i, "") : ""}` : r.note || (r.type === "investment" ? t.investment : t.withdrawal))}</td>
      <td class="r">${r.in ? money(r.in, lang) : ""}</td><td class="r">${r.out ? money(r.out, lang) : ""}</td><td class="r"><strong>${r.balance < 0 ? "−" : ""}${money(r.balance, lang)}</strong></td></tr>`).join("")
    : `<tr><td colspan="6" class="c muted" style="padding:22px">${esc(t.noEntries)}</td></tr>`}</tbody></table>
<div class="foot">${sigs([{ label: t.partnerSig, who: d.partner.name }, { label: t.authSig, who: d.brand.signatory }])}${fine(t, lang)}</div>`;
}

function settlementBody(d: Extract<DocData, { kind: "settlement" }>, lang: DocLang, t: Lx) {
  const x = d.s;
  const pl = x.pnl as Record<string, number | string>;
  const v = (k: string) => Number(pl[k] ?? 0);
  const isVoid = x.status === "void";
  const meta: [string, string][] = [[t.settlementNo, `<strong>#${num(x.no, lang)}</strong>`], [t.period, esc(`${date(x.period_from, lang)} – ${date(x.period_to, lang)}`)],
    [t.status, pill(isVoid ? t.statusText.void : t.statusText.final, isVoid ? "bad" : "ok")]];
  const line = (k: string, n: number, cls = "") => `<tr class="${cls}"><td>${esc(k)}</td><td>${n < 0 ? "−" : ""}${money(n, lang)}</td></tr>`;
  const pnlRows = [
    line(t.revenue, v("revenue")), line(t.cogs, -v("cogs")), line(t.directCosts, -v("direct_costs")),
    line(t.grossProfit, v("gross_profit"), "sub"), line(t.opex, -v("operating_expenses")),
    ...(v("other_income") ? [line(t.otherIncome, v("other_income"))] : []),
    line(t.netProfit, x.net_profit, "grand"),
    ...(x.carry_in ? [line(t.carriedLoss, -x.carry_in)] : []),
    line(t.distributable, x.distributable, "due"),
    ...(x.carry_out ? [line(t.carryOut, x.carry_out)] : []),
  ].join("");
  const tot = x.rows.reduce((a, r) => ({ share: a.share + r.share, paid: a.paid + r.paid, ret: a.ret + r.retained }), { share: 0, paid: 0, ret: 0 });
  return `${header(d.brand, t.settlementTitle, meta, lang)}
<div class="rule"></div>
${isVoid ? `<div class="stampwrap"><div class="stamp due ${lang}" style="right:20px;top:-4px">${esc(t.stamp.void)}</div></div>` : ""}
<div class="after" style="margin-top:0">
  <div class="words">${x.note ? `<div class="lbl">${esc(t.description)}</div><div>${esc(x.note)}</div>` : ""}
    ${isVoid ? `<p class="muted" style="margin-top:8px">${esc(t.voidNote)}${x.void_reason ? ` ${esc(t.reason)}: ${esc(x.void_reason)}` : ""}</p>` : ""}
    ${x.distributable === 0 && !isVoid ? `<p class="muted" style="margin-top:8px">${esc(t.lossNote)}</p>` : ""}</div>
  <table class="totals" style="width:320px">${pnlRows}</table>
</div>
${x.rows.length && x.distributable > 0 ? `<table class="items"><thead><tr><th>${esc(t.partner)}</th><th class="r">%</th><th class="r">${esc(t.shareCol)}</th><th class="r">${esc(t.paidCol)}</th><th class="r">${esc(t.retainedCol)}</th></tr></thead>
<tbody>${x.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="r">${num(r.percentage, lang)}%</td><td class="r"><strong>${money(r.share, lang)}</strong></td><td class="r">${money(r.paid, lang)}</td><td class="r">${money(r.retained, lang)}</td></tr>`).join("")}
<tr><td><strong>${esc(t.total)}</strong></td><td class="r">${num(100, lang)}%</td><td class="r"><strong>${money(tot.share, lang)}</strong></td><td class="r"><strong>${money(tot.paid, lang)}</strong></td><td class="r"><strong>${money(tot.ret, lang)}</strong></td></tr></tbody></table>` : ""}
<div class="foot">${sigs([{ label: t.preparedBy, who: x.created_by_name }, ...x.rows.slice(0, 2).map((r) => ({ label: t.partnerSig, who: r.name })), { label: t.authSig, who: d.brand.signatory }].slice(0, 4))}${fine(t, lang)}</div>`;
}

export function documentTitle(d: DocData, lang: DocLang) {
  const t = L[lang];
  if (d.kind === "invoice") return `${invoiceNo(d.order.order_no)}`;
  if (d.kind === "voucher") return `${docNo(d.txn.txn_type, d.txn.doc_no)}`;
  if (d.kind === "settlement") return `${t.settlementTitle} #${d.s.no}`;
  return `${t.statement} — ${d.partner.name}`;
}
export function fileName(d: DocData, lang: DocLang) {
  const base = d.kind === "statement" ? `Capital-Statement-${d.partner.name}`
    : d.kind === "settlement" ? `Profit-Distribution-${d.s.no}-${d.s.period_from}-to-${d.s.period_to}` : documentTitle(d, lang);
  return `${d.brand.name}-${base}-${lang}`.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-") + ".pdf";
}

export function renderDocument(d: DocData, lang: DocLang, opts: { toolbar?: { pdf: string; other: string } } = {}) {
  const t = L[lang];
  const body = d.kind === "invoice" ? invoiceBody(d, lang, t) : d.kind === "voucher" ? voucherBody(d, lang, t)
    : d.kind === "settlement" ? settlementBody(d, lang, t) : statementBody(d, lang, t);
  const toolbar = opts.toolbar
    ? `<div class="toolbar"><button onclick="window.print()">${esc(t.print)}</button><a class="primary" href="${esc(opts.toolbar.pdf)}">${esc(t.download)}</a><a href="${esc(opts.toolbar.other)}">${esc(t.other)}</a></div>`
    : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(documentTitle(d, lang))} · ${esc(d.brand.name)}</title><style>${fonts()}${CSS}</style></head>
<body>${toolbar}<div class="sheet"><div class="doc ${lang}">${body}</div></div></body></html>`;
}
