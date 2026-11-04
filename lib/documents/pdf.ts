import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";

async function launch(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true, defaultViewport: { width: 1240, height: 1754 } });
  }
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-gpu"], headless: true });
}

/** Renders self-contained HTML (fonts and logo inlined) to an A4 PDF with selectable text. */
export async function htmlToPdf(html: string, footerLabel: string): Promise<Uint8Array> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => true);
    const safe = footerLabel.replace(/[^\x20-\x7E]/g, "").replace(/[<>&]/g, "");
    return await page.pdf({
      format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7px;color:#9ca3af;padding:0 14mm;display:flex;justify-content:space-between"><span>${safe}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close().catch(() => {});
  }
}
