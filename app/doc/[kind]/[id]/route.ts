import { NextResponse, type NextRequest } from "next/server";
import { loadDocument, type DocLang } from "@/lib/documents/load";
import { documentTitle, fileName, renderDocument } from "@/lib/documents/render";
import { htmlToPdf } from "@/lib/documents/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** /doc/{invoice|voucher|statement}/{id}?lang=bn|en&format=pdf|html */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const q = req.nextUrl.searchParams;
  const lang: DocLang = q.get("lang") === "en" ? "en" : "bn";
  const data = await loadDocument(kind, id, q);
  if (!data) return new NextResponse("Not found", { status: 404 });

  if (q.get("format") !== "pdf") {
    const link = (p: Record<string, string>) => { const u = new URLSearchParams(q); Object.entries(p).forEach(([k, v]) => u.set(k, v)); return `?${u}`; };
    const html = renderDocument(data, lang, { toolbar: { pdf: link({ format: "pdf" }), other: link({ lang: lang === "bn" ? "en" : "bn" }) } });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  }

  try {
    const pdf = await htmlToPdf(renderDocument(data, lang), `${data.brand.name} · ${documentTitle(data, "en")}`);
    const name = fileName(data, lang);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[CORE] pdf", e);
    return new NextResponse("PDF generation failed. Please use Print → Save as PDF from the preview.", { status: 500 });
  }
}
