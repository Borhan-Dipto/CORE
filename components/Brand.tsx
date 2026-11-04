import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="CORE home">
      <span className="grid size-7 place-items-center rounded-md bg-ink">
        <span className="size-2.5 rounded-sm bg-white" />
      </span>
      <span className="text-[15px] font-semibold tracking-[0.2em]">CORE</span>
    </Link>
  );
}

/** Centered card used by login / reset / invite pages. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8"><Logo href="/login" /></div>
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
    </main>
  );
}
