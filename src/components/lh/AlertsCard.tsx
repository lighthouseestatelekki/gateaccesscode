import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { alertStatus, enableAlerts, type AlertStatus } from "@/lib/push";
import { cn } from "@/lib/utils";

/** "Get alerts on this phone" — hidden once alerts are on. */
export function AlertsCard({ userId, tone = "light", className }: { userId: string | null | undefined; tone?: "light" | "dark"; className?: string }) {
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    alertStatus().then(setStatus);
  }, []);

  if (!userId || !status || status === "on" || status === "unsupported") return null;

  async function turnOn() {
    setBusy(true);
    setError("");
    try {
      await enableAlerts(userId!);
      setStatus("on");
    } catch (e) {
      setError((e as Error).message);
      setStatus(await alertStatus());
    }
    setBusy(false);
  }

  const dark = tone === "dark";
  return (
    <div className={cn("rounded-lg p-4", dark ? "bg-deep-mid text-deep-foreground" : "bg-mint-lightest", className)}>
      <div className="flex items-center gap-3">
        <BellRing className={cn("size-6 shrink-0", dark ? "text-gold" : "text-deep")} />
        <p className={cn("flex-1 text-sm", dark ? "text-deep-foreground/85" : "text-text-2")}>
          {status === "ios-install-first"
            ? "To get alerts on iPhone: tap Share, then Add to Home Screen, then open Light House from your Home Screen."
            : status === "blocked"
              ? "Alerts are blocked for this site. Allow notifications in your phone's settings, then come back."
              : "Get alerts on this phone for visitors, announcements and SOS."}
        </p>
        {status === "off" && (
          <button onClick={turnOn} disabled={busy} className={cn("min-h-11 shrink-0 rounded-sm px-4 text-sm font-semibold", dark ? "bg-primary text-primary-foreground" : "bg-card text-deep")}>
            {busy ? "…" : "Turn on"}
          </button>
        )}
      </div>
      {error && <p role="alert" className={cn("mt-2 text-sm font-medium", dark ? "text-red-300" : "text-destructive")}>{error}</p>}
    </div>
  );
}
