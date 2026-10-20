import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type R = { entries: number; staff_entries: number; codes_created: number; per_day: { day: string; n: number }[] };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Small version of Insights for Home: three numbers and the last 7 days. Tap for the full page. */
export function InsightsSnapshot() {
  const [d, setD] = useState<R | null>(null);
  useEffect(() => {
    supabase.rpc("resident_insights", { p_days: 30 }).then(({ data }) => data && setD(data as R));
  }, []);
  if (!d) return null;
  const week = (d.per_day ?? []).slice(-7);
  const max = Math.max(1, ...week.map((p) => Number(p.n)));
  const stats: [string, number][] = [
    ["Visitors", d.entries - d.staff_entries],
    ["Codes made", d.codes_created],
    ["Staff entries", d.staff_entries],
  ];
  return (
    <Link to="/insights" aria-label="Insights, last 30 days. Open full insights" className="block rounded-[22px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-primary" />
        <h2 className="flex-1 text-lg font-bold">Insights</h2>
        <span className="text-xs font-semibold text-text-2">Last 30 days</span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([l, n]) => (
          <div key={l} className="rounded-xl bg-mint-lightest px-3 py-2.5">
            <p className="font-display text-2xl font-extrabold leading-none text-foreground">{n}</p>
            <p className="mt-1 text-[11px] font-semibold text-text-2">{l}</p>
          </div>
        ))}
      </div>
      {week.length > 0 && (
        <div className="mt-3">
          <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
            {week.map((p) => (
              <div key={p.day} className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-t-[4px] bg-primary" style={{ height: `${Math.max(Number(p.n) ? 8 : 2, (Number(p.n) / max) * 100)}%`, opacity: Number(p.n) ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-center text-[10px] font-semibold text-muted-foreground" aria-hidden="true">
            {week.map((p) => <span key={p.day} className="flex-1">{DAYS[new Date(`${p.day}T12:00:00Z`).getUTCDay()]}</span>)}
          </div>
          <p className="sr-only">Entries in the last 7 days: {week.map((p) => `${DAYS[new Date(`${p.day}T12:00:00Z`).getUTCDay()]} ${p.n}`).join(", ")}</p>
        </div>
      )}
    </Link>
  );
}
