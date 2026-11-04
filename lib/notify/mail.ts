import "server-only";
import nodemailer from "nodemailer";
import { notificationText, type NotifLang } from "./text";

export type Outgoing = { id: string; email: string; name: string; language: string | null; kind: string; payload: Record<string, unknown>; link: string | null };

export const mailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: nodemailer.Transporter | null = null;
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!.replace(/\s+/g, "") },
    });
  }
  return transport;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(n: Outgoing) {
  const lang: NotifLang = n.language === "en" ? "en" : "bn";
  const { title, body } = notificationText(n.kind, n.payload, lang);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://core-bos.vercel.app").replace(/\/$/, "");
  const url = site + (n.link ?? "/");
  const open = lang === "bn" ? "CORE-এ খুলুন" : "Open in CORE";
  const foot = lang === "bn" ? "ইমেইল বন্ধ করতে CORE → অ্যাকাউন্ট → নোটিফিকেশন।" : "To stop these emails: CORE → Account → Notifications.";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Inter,'Noto Sans Bengali',Segoe UI,Arial,sans-serif;color:#0a0a0a">
<div style="max-width:520px;margin:0 auto;padding:28px 16px">
 <div style="font-weight:700;letter-spacing:.08em;font-size:12px;color:#52525b;margin-bottom:14px">CORE · ${esc(String(n.payload.business ?? ""))}</div>
 <div style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:22px">
  <div style="font-size:17px;font-weight:600;margin-bottom:8px">${esc(title)}</div>
  <div style="font-size:14px;line-height:1.6;color:#3f3f46">${esc(body)}</div>
  <a href="${esc(url)}" style="display:inline-block;margin-top:18px;background:#0a0a0a;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:9px 16px;border-radius:8px">${open}</a>
 </div>
 <div style="font-size:12px;color:#a1a1aa;margin-top:14px">${esc(foot)}</div>
</div></body></html>`;
  return { subject: title, html, text: `${title}\n\n${body}\n\n${url}` };
}

/** Sends each email; returns ids that failed. */
export async function sendAll(list: Outgoing[]): Promise<string[]> {
  if (!mailConfigured() || !list.length) return list.map((n) => n.id);
  const from = `"${process.env.MAIL_FROM_NAME || "CORE"}" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`;
  const failed: string[] = [];
  await Promise.all(list.map(async (n) => {
    try {
      const m = render(n);
      await mailer().sendMail({ from, to: n.email, subject: m.subject, html: m.html, text: m.text });
    } catch (e) {
      console.error("[CORE] mail", n.id, (e as Error).message);
      failed.push(n.id);
    }
  }));
  return failed;
}
