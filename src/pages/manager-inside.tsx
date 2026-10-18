import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bike, BriefcaseBusiness, CalendarRange, RefreshCw, UserRound } from "lucide-react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { formatWhen } from "@/lib/when";
import { DELIVERY_NAME } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export const title = "Inside now";

export type Inside = {
  code_id: string;
  holder: string;
  type: string;
  house_number: string;
  house_unit: string;
  entered_at: string;
  valid_to: string | null;
  overstay: boolean;
  job_title: string | null;
};

function kindOf(p: Inside) {
  if (p.type === "employee") return { label: `Staff${p.job_title ? ` · ${p.job_title}` : ""}`, Icon: BriefcaseBusiness };
  if (p.type === "long_stay") return { label: "Long stay", Icon: CalendarRange };
  if (p.holder === DELIVERY_NAME) return { label: "Delivery", Icon: Bike };
  return { label: "Visitor", Icon: UserRound };
}

/** Estate Manager only: everyone whose last gate scan was IN. Overstays are at the top. */
function ManagerInside() {
  const me = useManager();
  const [list, setList] = useState<Inside[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("inside_now");
    setError(err ? "This list is not switched on yet. Please check back soon." : "");
    setList((data ?? []) as Inside[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!me) return;
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me, load]);

  if (!me) return null;
  const over = (list ?? []).filter((p) => p.overstay).length;

  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold">Inside now</h1>
          <button onClick={load} aria-label="Refresh" className="flex size-11 items-center justify-center rounded-full bg-white/10"><RefreshCw className={cn("size-5", loading && "animate-spin")} /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 divide-x divide-deep-foreground/15 rounded-sm bg-deep-dark/40 py-3">
          <div className="px-4"><p className="font-display text-2xl font-bold">{list ? list.length : "–"}</p><p className="text-xs text-deep-foreground/70">People inside</p></div>
          <div className="px-4"><p className={cn("font-display text-2xl font-bold", over > 0 && "text-gold")}>{list ? over : "–"}</p><p className="text-xs text-deep-foreground/70">Past their code time</p></div>
        </div>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        {error && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{error}</p>}
        {over > 0 && <p className="rounded-2xl bg-destructive-light p-3 text-sm font-medium text-destructive">You get an alert 15 minutes after a visitor's code ends if the gate has not seen them leave.</p>}
        <ul className="divide-y divide-border overflow-hidden rounded-[22px] border border-border bg-card">
          {(list ?? []).map((p) => {
            const { label, Icon } = kindOf(p);
            return (
              <li key={p.code_id} className={cn("flex min-h-16 items-center gap-3 px-4 py-3", p.overstay && "bg-destructive-light/50")}>
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", p.overstay ? "bg-destructive text-destructive-foreground" : "bg-mint-light text-deep")}>
                  {p.overstay ? <AlertTriangle className="size-5" /> : <Icon className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.holder}</p>
                  <p className="truncate text-sm text-text-2">House {p.house_number} · {codeToUnit(p.house_unit)} · {label}</p>
                  <p className={cn("text-xs", p.overstay ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    Came in: {formatWhen(p.entered_at)}{p.overstay && p.valid_to ? ` · code ended: ${formatWhen(p.valid_to)}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
          {list && list.length === 0 && !error && <li className="p-6 text-center text-text-2">Nobody is inside right now.</li>}
        </ul>
        <p className="text-center text-xs text-muted-foreground">Based on gate scans. Someone who left without the guard checking their code out may still show here.</p>
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default ManagerInside;
