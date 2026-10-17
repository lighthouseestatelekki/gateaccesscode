import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Hero, Screen, Sheet } from "@/components/lh/ui";
import { BarList, ColumnChart, dayPoints, hourPoints, StatTile } from "@/components/lh/charts";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";

export const title = "Insights";

type R = {
  days: number; entries: number; refused: number; codes_created: number; staff_entries: number;
  per_day: { day: string; n: number }[]; per_hour: { hour: number; n: number }[]; top_visitors: { name: string; n: number }[];
};

function Insights() {
  const profile = useResident();
  const [d, setD] = useState<R | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profile) return;
    supabase.rpc("resident_insights", { p_days: 30 }).then(({ data, error: err }) => (err ? setError(err.message) : setD(data as R)));
  }, [profile]);
  if (!profile) return null;
  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Insights</h1>
        <p className="mt-1 text-deep-foreground/70">Visitors to House {profile.house_number} in the last 30 days.</p>
      </Hero>
      <Sheet className="space-y-4">
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Visitor entries" value={d.entries - d.staff_entries} />
              <StatTile label="Staff entries" value={d.staff_entries} />
              <StatTile label="Codes created" value={d.codes_created} />
              <StatTile label="Refused at gate" value={d.refused} tone={d.refused > 0 ? "warn" : "plain"} />
            </div>
            <ColumnChart title="Entries per day" subtitle="Last 14 days" points={dayPoints(d.per_day)} labelEvery={2} />
            <ColumnChart title="Busiest times" subtitle="Entries by hour, last 30 days" points={hourPoints(d.per_hour)} labelEvery={6} />
            <BarList title="Most frequent visitors" subtitle="Last 30 days" rows={d.top_visitors.map((v) => ({ label: v.name, n: Number(v.n) }))} empty="No visitors yet." />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

export default Insights;
