"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLang } from "@/app/actions";
import type { Lang } from "@/lib/i18n";

export function AuthLang({ lang }: { lang: Lang }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => setLang(lang === "bn" ? "en" : "bn"))}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
      <Languages className="size-3.5" /> {lang === "bn" ? "English" : "বাংলা"}
    </button>
  );
}
