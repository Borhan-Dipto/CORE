"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchEmails } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";
import { getT, siteUrl } from "@/lib/session";
import { errorKey, type Dict } from "@/lib/i18n";

export type FormState = { error?: string; ok?: string; link?: string; email?: string; checkEmail?: boolean; at?: number };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const amount = (fd: FormData, k = "amount") => Number(str(fd, k).replace(/[^\d.]/g, "")) || 0;
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/");
const INVITE_COOKIE = "core_invite";

async function msg(key: keyof Dict) {
  const { t } = await getT();
  return t[key] as string;
}
async function fail(e: { message?: string; code?: string } | null, ctx?: "invite" | "name"): Promise<FormState> {
  const { t } = await getT();
  if (e) console.error("[CORE]", e.code, e.message);
  return { error: t[errorKey(e, ctx)], at: Date.now() };
}
async function ok(key: keyof Dict, extra: Partial<FormState> = {}): Promise<FormState> {
  return { ok: await msg(key), at: Date.now(), ...extra };
}
/** Email partners about the change after the response is sent (never blocks or fails the action). */
function notifyLater(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string) {
  after(() => dispatchEmails(supabase, businessId));
}
function refresh(businessId?: string) {
  if (businessId) revalidatePath(`/b/${businessId}`, "layout");
  revalidatePath("/", "layout");
}

// ---------- Auth ----------
export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email").toLowerCase(), password: str(fd, "password") });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "email_not_confirmed") return { error: await msg("emailNotConfirmed"), at: Date.now() };
    if (error.status === 429) return { error: await msg("rateLimited"), at: Date.now() };
    return { error: await msg("invalidLogin"), at: Date.now() };
  }
  redirect(safeNext(str(fd, "next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(str(fd, "email").toLowerCase(), {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return { error: await msg("rateLimited"), at: Date.now() };
  return ok("resetSent"); // same reply whether or not the account exists
}

function checkPasswords(fd: FormData): keyof Dict | null {
  const p = str(fd, "password");
  if (p.length < 8) return "passwordTooShort";
  if (fd.has("confirm") && p !== str(fd, "confirm")) return "passwordsDontMatch";
  return null;
}

export async function setNewPassword(_: FormState, fd: FormData): Promise<FormState> {
  const bad = checkPasswords(fd);
  if (bad) return { error: await msg(bad), at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: str(fd, "password") });
  if (error) return fail(error);
  return ok("passwordSaved");
}

// ---------- Preferences ----------
const YEAR = 60 * 60 * 24 * 365;
export async function setLang(lang: "bn" | "en") {
  (await cookies()).set("lang", lang === "en" ? "en" : "bn", { path: "/", maxAge: YEAR, sameSite: "lax" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ language: lang }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function setTheme(theme: "light" | "dark" | "system") {
  const v = ["light", "dark", "system"].includes(theme) ? theme : "light";
  (await cookies()).set("theme", v, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ theme: v }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("profiles").update({ full_name: opt(fd, "full_name") }).eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return ok("saved");
}

// ---------- Businesses ----------
function businessFields(fd: FormData) {
  const month = Number(str(fd, "fiscal_year_start_month")) || 7;
  return {
    name: str(fd, "name"), description: opt(fd, "description"), category: opt(fd, "category"), email: opt(fd, "email"),
    phone: opt(fd, "phone"), address: opt(fd, "address"), start_date: opt(fd, "start_date"),
    fiscal_year_start_month: Math.min(12, Math.max(1, month)),
  };
}

export async function createBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const fields = businessFields(fd);
  if (!fields.name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").insert(fields).select("id").single();
  if (error) return fail(error, "name");
  refresh();
  redirect(`/b/${data.id}`);
}

export async function updateBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const fields = businessFields(fd);
  if (!fields.name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").update(fields).eq("id", str(fd, "id")).eq("status", "active").select("id");
  if (error) return fail(error, "name");
  if (!data?.length) return fail({ message: "not_authorized" });
  refresh(str(fd, "id"));
  return ok("saved");
}

export async function setBusinessStatus(id: string, status: "active" | "archived") {
  const supabase = await createClient();
  await supabase.from("businesses").update({ status }).eq("id", id);
  refresh(id);
}

// ---------- Partners & invites ----------
export async function createInvite(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const email = str(fd, "email").toLowerCase();
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", { p_business: businessId, p_email: email });
  if (error) return fail(error, "invite");
  refresh(businessId);
  return { link: `${await siteUrl()}/invite/${token}`, email, at: Date.now() };
}

/** Revoke a pending invite and immediately issue a fresh link for the same email. */
export async function reissueInvite(invitationId: string, businessId: string, email: string): Promise<FormState> {
  const supabase = await createClient();
  const { error: e1 } = await supabase.rpc("revoke_invitation", { p_invitation: invitationId });
  if (e1) return fail(e1, "invite");
  const { data: token, error } = await supabase.rpc("create_invitation", { p_business: businessId, p_email: email });
  if (error) return fail(error, "invite");
  refresh(businessId);
  return { link: `${await siteUrl()}/invite/${token}`, email, at: Date.now() };
}

export async function revokeInvite(invitationId: string, businessId: string) {
  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_invitation: invitationId });
  refresh(businessId);
}

export async function removeMember(memberId: string, businessId: string) {
  const supabase = await createClient();
  await supabase.rpc("remove_member", { p_member: memberId });
  refresh(businessId);
}

export async function rejoinAsPartner(businessId: string) {
  const supabase = await createClient();
  await supabase.rpc("add_owner_membership", { p_business: businessId });
  refresh(businessId);
}

export async function saveProfitSplit(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const pct = fd.getAll("percentage");
  const shares = fd.getAll("user_id").map((u, i) => ({
    user_id: String(u), percentage: Number(String(pct[i] ?? "0").replace(/[^\d.]/g, "")) || 0,
  }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profit_shares", { p_business: businessId, p_effective: str(fd, "effective_from"), p_shares: shares });
  if (error) return fail(error);
  refresh(businessId);
  return ok("splitSaved");
}

// ---------- Invitation acceptance ----------
/** Remember the invite so it is accepted after any login path (see middleware). */
async function rememberInvite(token: string) {
  (await cookies()).set(INVITE_COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 7 });
}

async function acceptAndGo(token: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: businessId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return fail(error);
  (await cookies()).delete(INVITE_COOKIE);
  refresh();
  redirect(`/b/${businessId}`);
}

export async function acceptInvite(_: FormState, fd: FormData): Promise<FormState> {
  return acceptAndGo(str(fd, "token"));
}

export async function loginForInvite(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  await rememberInvite(token);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email").toLowerCase(), password: str(fd, "password") });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "email_not_confirmed") return { error: await msg("emailNotConfirmed"), at: Date.now() };
    if (error.status === 429) return { error: await msg("rateLimited"), at: Date.now() };
    return { error: await msg("invalidLogin"), at: Date.now() };
  }
  return acceptAndGo(token);
}

export async function signupForInvite(_: FormState, fd: FormData): Promise<FormState> {
  const bad = checkPasswords(fd);
  if (bad) return { error: await msg(bad), at: Date.now() };
  const token = str(fd, "token");
  await rememberInvite(token);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    options: { data: { full_name: str(fd, "full_name") }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/invite/${token}` },
  });
  if (error) {
    if (error.status === 429) return { error: await msg("rateLimited"), at: Date.now() };
    return fail(error);
  }
  if (!data.session) return { checkEmail: true, at: Date.now() };
  return acceptAndGo(token);
}

// ---------- Finance ----------
type Post = {
  p_business: string; p_type: "expense" | "income" | "investment" | "withdrawal" | "transfer"; p_date: string; p_amount: number;
  p_account?: string | null; p_to_account?: string | null; p_category?: string | null; p_partner?: string | null;
  p_title?: string | null; p_description?: string | null; p_reference?: string | null; p_ad_platform?: string | null;
  p_campaign?: string | null; p_target_product?: string | null;
};
async function post(args: Post, okKey: keyof Dict): Promise<FormState> {
  if (!(args.p_amount > 0)) return fail({ message: "invalid_amount" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_transaction", args);
  if (error) return fail(error);
  refresh(args.p_business);
  notifyLater(supabase, args.p_business);
  return ok(okKey);
}

export async function recordExpense(_: FormState, fd: FormData): Promise<FormState> {
  const source = str(fd, "source");
  return post({
    p_business: str(fd, "business_id"), p_type: "expense", p_date: str(fd, "date"), p_amount: amount(fd),
    p_category: opt(fd, "category_id"),
    p_account: source === "partner" ? null : opt(fd, "account_id"),
    p_partner: source === "partner" ? opt(fd, "partner_id") : null,
    p_title: opt(fd, "title"), p_description: opt(fd, "description"), p_reference: opt(fd, "reference"),
    p_ad_platform: opt(fd, "ad_platform"), p_campaign: opt(fd, "campaign"), p_target_product: opt(fd, "target_product"),
  }, "expenseRecorded");
}

export async function recordInvestment(_: FormState, fd: FormData): Promise<FormState> {
  const acc = opt(fd, "account_id");
  return post({
    p_business: str(fd, "business_id"), p_type: "investment", p_date: str(fd, "date"), p_amount: amount(fd),
    p_partner: opt(fd, "partner_id"), p_account: acc === "none" ? null : acc,
    p_title: opt(fd, "title"), p_reference: opt(fd, "reference"),
  }, "investmentRecorded");
}

export async function recordWithdrawal(_: FormState, fd: FormData): Promise<FormState> {
  return post({
    p_business: str(fd, "business_id"), p_type: "withdrawal", p_date: str(fd, "date"), p_amount: amount(fd),
    p_partner: opt(fd, "partner_id"), p_account: opt(fd, "account_id"), p_title: opt(fd, "title"), p_reference: opt(fd, "reference"),
  }, "withdrawalRecorded");
}

export async function recordTransfer(_: FormState, fd: FormData): Promise<FormState> {
  return post({
    p_business: str(fd, "business_id"), p_type: "transfer", p_date: str(fd, "date"), p_amount: amount(fd),
    p_account: opt(fd, "account_id"), p_to_account: opt(fd, "to_account_id"), p_title: opt(fd, "title"),
  }, "transferRecorded");
}

export async function recordIncome(_: FormState, fd: FormData): Promise<FormState> {
  return post({
    p_business: str(fd, "business_id"), p_type: "income", p_date: str(fd, "date"), p_amount: amount(fd),
    p_account: opt(fd, "account_id"), p_title: opt(fd, "title"), p_reference: opt(fd, "reference"),
  }, "incomeRecorded");
}

export async function reverseTxn(txnId: string, businessId: string, reason: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_transaction", { p_txn: txnId, p_reason: reason });
  if (error) return fail(error);
  refresh(businessId);
  notifyLater(supabase, businessId);
  return ok("reversedOk");
}

export async function addAccount(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.from("business_accounts").insert({
    business_id: str(fd, "business_id"), name, type: str(fd, "type") || "cash", opening_balance: amount(fd, "opening_balance"),
  });
  if (error) return fail(error, "name");
  refresh(str(fd, "business_id"));
  return ok("accountAdded");
}

export async function toggleAccount(id: string, businessId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("business_accounts").update({ is_active: active }).eq("id", id);
  refresh(businessId);
}

export async function addCategory(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").insert({
    business_id: str(fd, "business_id"), name, is_advertising: fd.get("is_advertising") === "on",
  });
  if (error) return fail(error, "name");
  refresh(str(fd, "business_id"));
  return ok("categoryAdded");
}

export async function toggleCategory(id: string, businessId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("expense_categories").update({ is_active: active }).eq("id", id);
  refresh(businessId);
}

// ---------- Sales ----------
export async function addProduct(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    business_id: str(fd, "business_id"), name, sku: opt(fd, "sku"), category: opt(fd, "category"),
    cost_price: amount(fd, "cost_price"), sell_price: amount(fd, "sell_price"),
  });
  if (error) return fail(error, "name");
  refresh(str(fd, "business_id"));
  return ok("productAdded");
}

export async function updateProduct(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: await msg("err_name_required"), at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({
    name, sku: opt(fd, "sku"), category: opt(fd, "category"), cost_price: amount(fd, "cost_price"), sell_price: amount(fd, "sell_price"),
  }).eq("id", str(fd, "id"));
  if (error) return fail(error, "name");
  refresh(str(fd, "business_id"));
  return ok("saved");
}

export async function toggleProduct(id: string, businessId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("products").update({ is_active: active }).eq("id", id);
  refresh(businessId);
}

const ORDER_MONEY = ["discount", "delivery_charge", "courier_cost", "packaging_cost", "cod_fee", "other_cost"];

export async function createOrder(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  let items: unknown;
  try { items = JSON.parse(str(fd, "items") || "[]"); } catch { items = []; }
  const order: Record<string, unknown> = {
    order_date: str(fd, "order_date"), status: str(fd, "status") || "pending", source: str(fd, "source") || "website",
    customer_name: str(fd, "customer_name"), customer_phone: str(fd, "customer_phone"), customer_address: str(fd, "customer_address"),
    notes: str(fd, "notes"), campaign_name: str(fd, "campaign_name"), courier: str(fd, "courier"), tracking_no: str(fd, "tracking_no"),
  };
  ORDER_MONEY.forEach((k) => (order[k] = amount(fd, k)));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", { p_business: businessId, p_order: order, p_items: items });
  if (error) return fail(error);
  refresh(businessId);
  return { ok: await msg("orderCreated"), link: `/b/${businessId}/orders/${data}`, at: Date.now() };
}

export async function setOrderStatus(orderId: string, businessId: string, status: string, note?: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", { p_order: orderId, p_status: status, p_note: note ?? null });
  if (error) return fail(error);
  refresh(businessId);
  return ok("statusUpdated");
}

export async function updateOrderInfo(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const p: Record<string, unknown> = {};
  ["customer_name", "customer_phone", "customer_address", "notes", "courier", "tracking_no", "campaign_name"].forEach((k) => { if (fd.has(k)) p[k] = str(fd, k); });
  ORDER_MONEY.forEach((k) => { if (fd.has(k)) p[k] = amount(fd, k); });
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_info", { p_order: str(fd, "order_id"), p });
  if (error) return fail(error);
  refresh(businessId);
  return ok("orderUpdated");
}

export async function collectOrder(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("collect_order", {
    p_order: str(fd, "order_id"), p_account: str(fd, "account_id"), p_amount: amount(fd), p_date: str(fd, "date") || null,
  });
  if (error) return fail(error);
  refresh(businessId);
  return ok("collectedOk");
}

export type ImportRow = { order: Record<string, unknown>; items: Record<string, unknown>[]; line: number };
export type ImportResult = { created: number; skipped: number; failed: { line: number; error: string }[] };

/** Import parsed CSV rows. Duplicate website order IDs (external_ref) are skipped, not double-counted. */
export async function importOrders(businessId: string, rows: ImportRow[]): Promise<ImportResult> {
  const { t } = await getT();
  const supabase = await createClient();
  const res: ImportResult = { created: 0, skipped: 0, failed: [] };
  for (const r of rows.slice(0, 1000)) {
    const { error } = await supabase.rpc("create_order", { p_business: businessId, p_order: r.order, p_items: r.items });
    if (!error) res.created++;
    else if (error.code === "23505") res.skipped++;
    else res.failed.push({ line: r.line, error: t[errorKey(error)] });
  }
  refresh(businessId);
  return res;
}

// ---------- Invoice & document settings ----------
export async function saveInvoiceSettings(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const logo = str(fd, "logo_data");
  const row: Record<string, string | null> = {
    business_id: businessId,
    tagline: opt(fd, "tagline"), website: opt(fd, "website"), payment_info: opt(fd, "payment_info"),
    policy_note: opt(fd, "policy_note"), thank_you: opt(fd, "thank_you"), signatory: opt(fd, "signatory"),
  };
  if (logo !== "__keep__") {
    if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) return { error: await msg("logoTooBig"), at: Date.now() };
    row.logo_data = logo || null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("business_invoice_settings").upsert(row, { onConflict: "business_id" });
  if (error) return fail(error);
  refresh(businessId);
  return ok("saved");
}

// ---------- Profit settlement ----------
export async function previewSettlement(businessId: string, from: string, to: string): Promise<{ preview?: import("@/lib/settlements").Preview; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("settlement_preview", { p_business: businessId, p_from: from, p_to: to });
  if (error) return { error: (await fail(error)).error };
  const p = data as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    preview: {
      period_from: String(p.period_from), period_to: String(p.period_to), next_from: (p.next_from as string) ?? null,
      net_profit: n(p.net_profit), carry_in: n(p.carry_in), distributable: n(p.distributable), carry_out: n(p.carry_out), shares_total: n(p.shares_total),
      allocations: ((p.allocations as Record<string, unknown>[]) ?? []).map((a) => ({
        partner_id: String(a.partner_id), name: (a.name as string) ?? null, percentage: n(a.percentage), share: n(a.share), active: !!a.active })),
    },
  };
}

export async function settleProfit(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  let payouts: unknown = [];
  try { payouts = JSON.parse(str(fd, "payouts") || "[]"); } catch { payouts = []; }
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_profit", {
    p_business: businessId, p_from: str(fd, "from"), p_to: str(fd, "to"), p_payouts: payouts,
    p_note: opt(fd, "note"), p_paid_on: opt(fd, "paid_on"),
  });
  if (error) return fail(error);
  refresh(businessId);
  notifyLater(supabase, businessId);
  return ok("settleDone");
}

export async function payProfit(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_profit", {
    p_settlement: str(fd, "settlement_id"), p_partner: str(fd, "partner_id"), p_account: opt(fd, "account_id"),
    p_amount: amount(fd), p_date: opt(fd, "date"),
  });
  if (error) return fail(error);
  refresh(businessId);
  notifyLater(supabase, businessId);
  return ok("saved");
}

export async function voidSettlement(settlementId: string, businessId: string, reason: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_settlement", { p_settlement: settlementId, p_reason: reason });
  if (error) return fail(error);
  refresh(businessId);
  notifyLater(supabase, businessId);
  return ok("saved");
}

// ---------- Notifications ----------
export async function getMyNotifications() {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, kind, payload, link, read_at, created_at, business_id")
    .order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export async function markNotificationsRead(ids?: string[]) {
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
}

export async function saveNotifyPrefs(prefs: { email: boolean; weekly: boolean }): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail({ message: "not_authorized" });
  const { error } = await supabase.from("profiles").update({ notify_prefs: { email: !!prefs.email, weekly: !!prefs.weekly } }).eq("id", user.id);
  if (error) return fail(error);
  return ok("saved");
}

export async function sendTestEmail(): Promise<FormState> {
  const { sendTest } = await import("@/lib/notify/mail");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return fail({ message: "not_authorized" });
  const { data: prof } = await supabase.from("profiles").select("full_name, language").eq("id", user.id).maybeSingle();
  const err = await sendTest(user.email, prof?.full_name ?? user.email, prof?.language ?? "bn");
  if (err) {
    console.error("[CORE] test mail", err);
    const { t } = await getT();
    return { error: err === "not_configured" ? t.mailNotConfigured : `${t.mailFailed} (${err.slice(0, 160)})`, at: Date.now() };
  }
  return { ok: (await getT()).t.mailSent + " " + user.email, at: Date.now() };
}

export async function deleteBusiness(id: string, confirmName: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_business", { p_business: id, p_confirm_name: confirmName });
  if (error) return fail(error);
  revalidatePath("/", "layout");
  redirect("/businesses?deleted=1");
}
