import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";

export const title = "Action history";

type Entry = { id: number; at: string; actor_name: string | null; actor_role: string | null; action: string; target: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true });

/** Everything the Estate Manager has done in the app. Read-only: entries cannot be edited or deleted. */
function ManagerHistory() {
  const me = useManager();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("audit_log").select("id,at,actor_name,actor_role,action,target").order("at", { ascending: false }).limit(limit);
    setLoadError(error ? "Action history is not switched on yet. Please check back soon." : "");
    setRows((data ?? []) as Entry[]);
  }, [limit]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  if (!me) return null;
  const groups: [string, Entry[]][] = [];
  for (const r of rows ?? []) {
    const d = day(r.at);
    const last = groups[groups.length - 1];
    if (last && last[0] === d) last[1].push(r);
    else groups.push([d, [r]]);
  }

  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Action history</h1>
        <p className="mt-1 text-deep-foreground/75">Every change made by the Estate Manager. It cannot be edited or deleted, and is kept for 24 months.</p>
      </Hero>
      <Sheet className="space-y-5 pb-6">
        {loadError && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{loadError}</p>}
        {groups.map(([d, list]) => (
          <section key={d}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{d}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-card">
              {list.map((r) => (
                <li key={r.id} className="flex gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground">{time(r.at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.action}</span>
                    {r.target && <span className="block text-sm text-text-2">{r.target}</span>}
                    <span className="block text-xs text-muted-foreground">{r.actor_role === "system" ? r.actor_name : `By ${r.actor_name ?? "Estate Manager"}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {rows && rows.length === 0 && !loadError && (
          <p className="flex flex-col items-center gap-2 rounded-lg bg-muted p-6 text-center text-text-2"><History className="size-8" />Nothing recorded yet.</p>
        )}
        {rows && rows.length >= limit && <button onClick={() => setLimit(limit + 200)} className="mx-auto block min-h-11 font-semibold text-deep">Show older</button>}
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default ManagerHistory;
