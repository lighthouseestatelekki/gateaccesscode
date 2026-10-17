import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { BarList, ColumnChart, dayPoints, hourPoints, StatTile } from "@/components/lh/charts";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { cn } from "@/lib/utils";

export const title = "Insights";

type M = {
  days: number; entries: number; entries_today: number; refused: number; night_entries: number; codes_created: number;
  residents_active: number; residents_pending: number; staff_active: number;
  sos: { total: number; resolved: number; false_alarm: number; open: number };
  per_day: { day: string; n: number }[]; per_hour: { hour: number; n: number }[];
  by_type: { guest: number; long_stay: number; employee: number };
  top_houses: { house: string; unit: string; n: number }[];
};

function ManagerInsights() {
  const me = useManager();
  const [days, setDays] = useState(30);
  const [d, setD] = useState<M | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!me) return;
    supabase.rpc("manager_insights", { p_days: days }).then(({ data, error: err }) => (err ? setError(err.message) : setD(data as M)));
  }, [me, days]);
  if (!me) return null;
  const pill = (on: boolean) => cn("min-h-10 rounded-full px-4 text-sm font-semibold", on ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2");
  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Insights</h1>
        <p className="mt-1 text-deep-foreground/70">How the gate and the estate are being used.</p>
      </Hero>
      <Sheet className="space-y-4">
        <div className="flex gap-2">
          {[7, 30, 90].map((n) => <button key={n} className={pill(days === n)} onClick={() => setDays(n)}>{n} days</button>)}
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Entries today" value={d.entries_today} />
              <StatTile label={`Entries, ${d.days} days`} value={d.entries} />
              <StatTile label="Night entries (10pm–5am)" value={d.night_entries} />
              <StatTile label="Refused at gate" value={d.refused} tone={d.refused > 0 ? "warn" : "plain"} />
              <StatTile label="Codes created" value={d.codes_created} />
              <StatTile label="SOS alerts" value={d.sos.total} tone={d.sos.open > 0 ? "warn" : "plain"} />
            </div>
            <ColumnChart title="Entries per day" subtitle="Last 14 days" points={dayPoints(d.per_day)} labelEvery={2} />
            <ColumnChart title="Busiest times at the gate" subtitle={`Entries by hour, last ${d.days} days`} points={hourPoints(d.per_hour)} labelEvery={6} />
            <BarList title="Who came in" subtitle={`By code type, last ${d.days} days`} rows={[
              { label: "Visitors (one visit)", n: d.by_type.guest },
              { label: "Long stay", n: d.by_type.long_stay },
              { label: "Staff", n: d.by_type.employee },
            ]} empty="No entries yet." />
            <BarList title="Busiest houses" subtitle={`Entries, last ${d.days} days`} rows={d.top_houses.map((h) => ({ label: `House ${h.house} · ${codeToUnit(h.unit)}`, n: Number(h.n) }))} empty="No entries yet." />
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-base font-semibold">People</h3>
              <dl className="mt-2 divide-y divide-border text-sm">
                {([["Approved residents", d.residents_active], ["Waiting for approval", d.residents_pending], ["Household staff", d.staff_active],
                   ["SOS resolved", d.sos.resolved], ["SOS false alarms", d.sos.false_alarm]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2"><dt className="text-text-2">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>
            </section>
          </>
        )}
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default ManagerInsights;
