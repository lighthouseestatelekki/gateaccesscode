import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { BottomSheet } from "@/components/lh/ui";
import { isInstalled, promptInstall } from "@/lib/install";
import { alertStatus, enableAlerts, type AlertStatus } from "@/lib/push";
import { cn } from "@/lib/utils";

const HIDE = "lh.setupHidden";

/**
 * "Finish setting up" for new residents. Starts part-done (registered + approved),
 * so the rest feels close. Disappears once everything is done, or when hidden.
 */
export function SetupCard({ userId, hasCodes }: { userId: string | null | undefined; hasCodes: boolean }) {
  const [alerts, setAlerts] = useState<AlertStatus | null>(null);
  const [installed, setInstalled] = useState(isInstalled);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE) === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [how, setHow] = useState<"" | "install" | "ios">("");

  useEffect(() => {
    alertStatus().then(setAlerts);
  }, []);

  if (hidden || !userId || alerts === null) return null;

  type Item = { key: string; t: string; d?: string; done: boolean; act?: () => void; to?: string };
  const items: Item[] = [
    { key: "reg", t: "Registered your house", done: true },
    { key: "ok", t: "Approved by the Estate Manager", done: true },
  ];
  if (alerts !== "unsupported") {
    items.push({
      key: "alerts", t: "Turn on alerts", done: alerts === "on",
      d: alerts === "blocked" ? "Allow notifications for this site in your phone's settings." : "Without them you won't know when visitors arrive, or about an SOS.",
      act: async () => {
        if (alerts === "ios-install-first") return setHow("ios");
        if (alerts === "blocked") return;
        setBusy(true);
        setError("");
        try {
          await enableAlerts(userId);
          setAlerts("on");
        } catch (e) {
          setError((e as Error).message);
          setAlerts(await alertStatus());
        }
        setBusy(false);
      },
    });
  }
  items.push({ key: "install", t: "Install the app", d: "One tap from your home screen.", done: installed, act: async () => { if (await promptInstall()) setInstalled(true); else setHow("install"); } });
  items.push({ key: "code", t: "Invite your first visitor", d: "Create a code and share it on WhatsApp.", done: hasCodes, to: "/create-code" });

  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  const pct = Math.round((done / items.length) * 100);

  return (
    <section className="rounded-[22px] border border-border bg-card p-4" aria-label="Finish setting up">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold">Finish setting up</h2>
          <p className="text-sm text-text-2">{items.length - done} quick {items.length - done === 1 ? "step" : "steps"} left</p>
        </div>
        <span className="font-display text-2xl font-extrabold text-primary">{pct}%</span>
        <button aria-label="Hide" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE, "1"); } catch { /* ignore */ } }} className="-mr-2 flex size-10 items-center justify-center text-muted-foreground"><X className="size-4" /></button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-mint-light" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-border">
        {items.map((i) => {
          const body = (
            <>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", i.done ? "bg-primary text-primary-foreground" : "border-2 border-border")}>
                {i.done && <Check className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px] font-semibold", i.done && "text-muted-foreground line-through")}>{i.t}</span>
                {!i.done && i.d && <span className="block text-xs text-muted-foreground">{i.d}</span>}
              </span>
              {!i.done && <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
            </>
          );
          const cls = "flex min-h-12 w-full items-center gap-3 py-2 text-left";
          if (i.done) return <li key={i.key} className={cls}>{body}</li>;
          if (i.to) return <li key={i.key}><Link to={i.to} className={cls}>{body}</Link></li>;
          return <li key={i.key}><button disabled={busy} onClick={i.act} className={cls}>{body}</button></li>;
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <BottomSheet open={!!how} onClose={() => setHow("")} title={how === "ios" ? "Alerts on iPhone" : "Install App"}>
        <div className="space-y-3 pb-4 text-base text-text-2">
          {how === "ios" ? (
            <p>Tap Share, then Add to Home Screen, then open Light House from your Home Screen and turn alerts on.</p>
          ) : (
            <>
              <p>iPhone: tap the Share icon, then Add to Home Screen.</p>
              <p>Android: tap the menu (three dots), then Add to Home screen.</p>
            </>
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
