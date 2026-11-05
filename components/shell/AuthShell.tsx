import { LogoMark } from "@/components/shell/Logo";
import type { Dict } from "@/lib/i18n";

/** Split layout for auth: brand panel (desktop) + focused form. */
export function AuthShell({ t, title, subtitle, children, footer }: {
  t: Dict; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#090b0f] p-12 text-[#ece8df] lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: "linear-gradient(rgb(212 175 106 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(212 175 106 / 0.05) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 70% 60%, black 10%, transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -right-32 -bottom-40 size-[560px] rounded-full bg-[#d4af6a] opacity-[0.10] blur-[130px]" />
        <svg aria-hidden viewBox="0 0 600 220" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-28 h-56 w-full opacity-70">
          <defs>
            <linearGradient id="auth-line" x1="0" x2="1"><stop offset="0" stopColor="#d4af6a" stopOpacity="0" /><stop offset="0.35" stopColor="#d4af6a" stopOpacity="0.55" /><stop offset="1" stopColor="#ecd39a" /></linearGradient>
            <linearGradient id="auth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4af6a" stopOpacity="0.16" /><stop offset="1" stopColor="#d4af6a" stopOpacity="0" /></linearGradient>
          </defs>
          <path d="M0 190 C60 182 90 170 140 160 S220 150 260 128 S330 120 370 98 S450 86 490 58 S560 34 600 18 L600 220 L0 220 Z" fill="url(#auth-fill)" />
          <path d="M0 190 C60 182 90 170 140 160 S220 150 260 128 S330 120 370 98 S450 86 490 58 S560 34 600 18" fill="none" stroke="url(#auth-line)" strokeWidth="2" />
          <circle cx="600" cy="18" r="4" fill="#ecd39a" />
        </svg>
        <div className="relative flex items-center gap-3"><LogoMark className="size-9" /><span className="font-display text-[22px] font-semibold tracking-[0.14em]">CORE</span></div>
        <div className="relative max-w-md">
          <p className="text-[13px] text-[#d4af6a]">Business Operating System</p>
          <h2 className="font-display mt-4 text-[44px] leading-[1.08] font-medium">{t.appTagline}</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#ece8df]/60">{t.appDescription}</p>
        </div>
        <p className="relative text-xs text-[#ece8df]/35">© CORE</p>
      </section>
      <section className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><LogoMark className="size-9" /><span className="font-display text-[22px] font-semibold tracking-[0.14em]">CORE</span></div>
        <div className="w-full max-w-sm">
          <h1 className="font-display text-[30px] font-medium leading-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
