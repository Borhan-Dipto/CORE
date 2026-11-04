"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";

export function SubmitButton({ children, className = "btn-primary", confirm }: { children: ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Notice({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-loss">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-profit">{state.ok}</p>;
  return null;
}

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary shrink-0"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      }}
    >
      {copied ? done : label}
    </button>
  );
}

/** A small form that runs a server action, with optional confirm dialog. */
export function ActionButton({ action, fields, children, className = "btn-ghost", confirm }: {
  action: (fd: FormData) => Promise<void>; fields: Record<string, string>; children: ReactNode; className?: string; confirm?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
        start(() => action(fd));
      }}
    >
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
