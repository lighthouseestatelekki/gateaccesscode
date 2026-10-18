import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike } from "lucide-react";
import { createDeliveryPass, DELIVERY_MINUTES } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** One tap → a 30-minute delivery code, straight to the share screen. */
export function QuickDelivery({ variant = "card", className }: { variant?: "card" | "chip"; className?: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const row = await createDeliveryPass();
      nav("/code-created", { state: row });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (variant === "chip") {
    return (
      <div className={className}>
        <button onClick={go} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-primary/40 bg-mint-lightest px-4 font-semibold text-deep disabled:opacity-60">
          <Bike className="size-5" /> {busy ? "Creating…" : `Quick delivery pass · ${DELIVERY_MINUTES} min`}
        </button>
        {error && <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <button onClick={go} disabled={busy} className={cn("flex min-h-16 w-full items-center gap-3 rounded-[20px] border border-border bg-card px-4 text-start shadow-sm transition active:scale-[0.99] disabled:opacity-60")}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-light text-deep"><Bike className="size-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">{busy ? "Creating…" : "Quick delivery pass"}</span>
          <span className="block text-sm text-text-2">{`One tap. Works for ${DELIVERY_MINUTES} minutes, in and out.`}</span>
        </span>
      </button>
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
