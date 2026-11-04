import { LogoMark } from "@/components/shell/Logo";
import type { Dict } from "@/lib/i18n";

/** Split layout for auth: brand panel (desktop) + focused form. */
export function AuthShell({ t, title, subtitle, children, footer }: {
  t: Dict; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b0d10] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-[#3b82f6] opacity-20 blur-[120px]" />
        <div className="relative flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden><rect width="32" height="32" rx="8" fill="#fff" /><rect x="9" y="9" width="14" height="14" rx="3.5" fill="none" stroke="#0b0d10" strokeWidth="2.4" /><rect x="13.5" y="13.5" width="5" height="5" rx="1.2" fill="#3b82f6" /></svg>
          <span className="text-base font-semibold tracking-[0.2em]">CORE</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/50">Business Operating System</p>
          <h2 className="mt-4 text-4xl leading-[1.15] font-semibold tracking-tight">{t.appTagline}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">{t.appDescription}</p>
        </div>
        <p className="relative text-xs text-white/40">© CORE</p>
      </section>
      <section className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden"><LogoMark className="size-8" /><span className="text-base font-semibold tracking-[0.2em]">CORE</span></div>
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
