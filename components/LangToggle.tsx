import { setLang } from "@/app/actions";
import type { Lang } from "@/lib/i18n";

export function LangToggle({ lang }: { lang: Lang }) {
  return (
    <form action={setLang} className="flex rounded-md border border-line bg-white p-0.5 text-xs font-medium">
      {(["bn", "en"] as const).map((l) => (
        <button
          key={l}
          name="lang"
          value={l}
          aria-pressed={lang === l}
          className={`rounded px-2 py-1 ${lang === l ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
        >
          {l === "bn" ? "বাং" : "EN"}
        </button>
      ))}
    </form>
  );
}
