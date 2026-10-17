import { Languages } from "lucide-react";
import { getLang, setLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** English / العربية, in the More menu. */
export function LangPicker() {
  const lang = getLang();
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Languages className="size-5" /> Language</h2>
      <div role="radiogroup" aria-label="Language" className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1.5" data-no-translate>
        {([["en", "English"], ["ar", "العربية"]] as const).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={lang === k} onClick={() => lang !== k && setLang(k)} className={cn("min-h-12 rounded-xl text-base font-semibold", lang === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Small switch for the welcome and sign-in screens (on the green header). */
export function LangSwitch({ className }: { className?: string }) {
  const lang = getLang();
  return (
    <button data-no-translate onClick={() => setLang(lang === "ar" ? "en" : "ar")} className={cn("min-h-10 whitespace-nowrap rounded-full bg-white/15 px-3.5 text-sm font-semibold text-white", className)}>
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
