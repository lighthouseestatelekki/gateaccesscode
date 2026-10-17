import { Check } from "lucide-react";
import { computeExpiry, formatUntil } from "@/lib/expiry";
import { cn } from "@/lib/utils";

export const EXPIRY_OPTIONS = ["Next 2 hours", "Today", "Tomorrow", "This weekend", "Pick date and time"] as const;

/** The best guess for "how long": late in the evening most visits are for tomorrow. */
export function defaultExpiry(now: Date = new Date()): string {
  const lagosHour = (now.getUTCHours() + 1) % 24;
  return lagosHour >= 20 ? "Tomorrow" : "Today";
}

/** Two columns of choices; each shows exactly when the code will stop working. */
export function ExpiryOptions({
  value,
  onChange,
  picked,
  onPickedChange,
}: {
  value: string;
  onChange: (option: string) => void;
  picked: string;
  onPickedChange: (picked: string) => void;
}) {
  const now = new Date();
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-2">Valid until</p>
      <div role="radiogroup" aria-label="Valid until" className="grid grid-cols-2 gap-2">
        {EXPIRY_OPTIONS.map((o) => {
          const on = value === o;
          const until = o === "Pick date and time" ? "Choose any day" : formatUntil(computeExpiry(o, now), now).replace(/^Until /, "");
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o}
              onClick={() => onChange(o)}
              className={cn(
                "relative flex min-h-16 flex-col items-start justify-center rounded-2xl border-[1.5px] px-3.5 py-2 text-left transition-colors",
                o === "Pick date and time" && "col-span-2",
                on ? "border-primary bg-mint-lightest text-deep" : "border-border bg-card text-foreground",
              )}
            >
              <span className="text-[15px] font-semibold leading-tight">{o}</span>
              <span className="mt-0.5 text-xs text-muted-foreground">{until}</span>
              {on && (
                <span className="absolute end-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {value === "Pick date and time" && (
        <input
          type="datetime-local"
          aria-label="Date and time"
          value={picked}
          onChange={(e) => onPickedChange(e.target.value)}
          className="mt-3 h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-4"
        />
      )}
    </div>
  );
}
