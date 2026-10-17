import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const EXPIRY_OPTIONS = ["Next 2 hours", "Today", "Tomorrow", "This weekend", "Pick date and time"] as const;

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
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-2">Valid until</p>
      <div className="space-y-2">
        {EXPIRY_OPTIONS.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "flex min-h-14 w-full items-center justify-between rounded-lg border-2 px-5 text-left text-base font-semibold transition-colors",
              value === o ? "border-primary bg-mint-lightest text-deep" : "border-border bg-card text-foreground",
            )}
          >
            {o}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2",
                value === o ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {value === o && <Check className="size-4" />}
            </span>
          </button>
        ))}
      </div>
      {value === "Pick date and time" && (
        <input
          type="datetime-local"
          value={picked}
          onChange={(e) => onPickedChange(e.target.value)}
          className="mt-3 h-12 w-full rounded-sm border border-border bg-card px-4"
        />
      )}
    </div>
  );
}
