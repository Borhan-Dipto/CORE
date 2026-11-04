import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fromGeneric, fromShopify, fromWoo, type Mapped } from "@/lib/integrations/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

function signatureValid(raw: string, secret: string, header: string | null) {
  if (!header) return null; // no signature sent → the secret URL alone authenticates
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(header.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Website order webhook: WooCommerce, Shopify or any site that can POST JSON. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) return ok({ ok: false, error: "unknown link" }, 404);
  const raw = await req.text();
  if (raw.length > 512_000) return ok({ ok: false, error: "payload too large" }, 413);

  const isWoo = req.headers.has("x-wc-webhook-source") || req.headers.has("x-wc-webhook-topic");
  const isShopify = req.headers.has("x-shopify-topic");
  const sig = signatureValid(raw, token, req.headers.get("x-wc-webhook-signature") ?? req.headers.get("x-shopify-hmac-sha256"));
  if (sig === false) return ok({ ok: false, error: "bad signature" }, 401);

  // WooCommerce sends a form-encoded ping when the webhook is saved
  if (!raw.trim().startsWith("{")) return ok({ ok: true, ping: true });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return ok({ ok: false, error: "invalid JSON" }, 400); }

  let mapped: Mapped;
  if (isWoo || ("line_items" in body && "billing" in body)) mapped = fromWoo(body);
  else if (isShopify || ("line_items" in body && "admin_graphql_api_id" in body)) mapped = fromShopify(body);
  else mapped = fromGeneric(body);
  if (!mapped.order.external_ref) return ok({ ok: false, error: "order id missing" }, 422);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("ingest_web_order", { p_token: token, p_order: mapped.order, p_items: mapped.items, p_status: mapped.status });
  if (error) {
    const unauthorized = /not_authorized/.test(error.message);
    if (!unauthorized) console.error("[CORE] web order", error.message);
    return ok({ ok: false, error: unauthorized ? "unknown link" : error.message.includes("business_inactive") ? "business archived" : "rejected" }, unauthorized ? 404 : 422);
  }
  // Always 200 for processed events (even "error": the reason is shown in CORE settings) so the site doesn't disable the webhook.
  return ok({ ok: true, ...(data as Record<string, unknown>) });
}

export function GET() {
  return ok({ ok: true, info: "CORE order webhook. Send POST requests with order JSON." });
}
