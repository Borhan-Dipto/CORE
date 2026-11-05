import { cn } from "@/lib/utils";

/** Consistent page frame: title, description, primary actions, then content. */
export function Page({ title, description, actions, children, className, wide, hero }: {
  title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean;
  /** replaces the plain title row with a signature panel (dashboard, overview) */
  hero?: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:py-8", wide ? "max-w-[1400px]" : "max-w-6xl", className)}>
      {hero ? <div className="mb-6">{hero}</div> : <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-medium leading-tight sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>}
      <div className="grid gap-6">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      {Icon && <div className="flex size-11 items-center justify-center rounded-full bg-muted"><Icon className="size-5 text-muted-foreground" /></div>}
      <div className="max-w-sm">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "warning", children }: { tone?: "warning" | "info"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border px-4 py-2.5 text-[13px]",
      tone === "warning" ? "border-warning/30 bg-warning-soft text-warning" : "border-brand/25 bg-brand-soft text-brand")}>
      {children}
    </div>
  );
}
