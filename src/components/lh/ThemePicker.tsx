import { useState } from "react";
import { Moon, Smartphone, Sun } from "lucide-react";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Light / Dark / Match phone. Remembered on this phone. */
export function ThemePicker() {
  const [t, setT] = useState<Theme>(getTheme);
  const opts: [Theme, string, typeof Sun][] = [["light", "Light", Sun], ["dark", "Dark", Moon], ["auto", "Match phone", Smartphone]];
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Theme</h2>
      <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5">
        {opts.map(([k, label, Icon]) => (
          <button
            key={k}
            role="radio"
            aria-checked={t === k}
            onClick={() => { setT(k); setTheme(k); }}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold", t === k ? "bg-card text-deep shadow-sm" : "text-text-2")}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
