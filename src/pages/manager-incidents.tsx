import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { BottomSheet, Button, Field, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { formatWhen } from "@/lib/when";
import { codeToUnit } from "@/lib/units";
import { incidentLabel, type Incident } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export const title = "Incidents";

type Row = Incident & { guard: { guard_number: string; full_name: string } | null };

/** Estate Manager: every incident a guard reported. Close each one with a short note. */
function ManagerIncidents() {
  const me = useManager();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [picked, setPicked] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("incidents")
      .select("*, guard:profiles!incidents_reported_by_fkey(guard_number,full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoadError(err ? "Incident reports are not switched on yet. Please check back soon." : "");
    setRows((data ?? []) as unknown as Row[]);
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function close() {
    if (!picked) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("close_incident", { p_id: picked.id, p_note: note.trim() || null });
    setBusy(false);
    if (err) return setError(err.message);
    setPicked(null);
    await load();
  }

  if (!me) return null;
  const open = (rows ?? []).filter((r) => r.status === "open");
  const shown = (rows ?? []).filter((r) => r.status === filter);

  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Incidents</h1>
        <p className="mt-1 text-deep-foreground/75">Reported by guards at the gate.</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        {loadError && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{loadError}</p>}
        <div role="radiogroup" aria-label="Show" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {([["open", `Open (${open.length})`], ["closed", "Closed"]] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cn("min-h-11 rounded-xl font-semibold", filter === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>{l}</button>
          ))}
        </div>
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id}>
              <button onClick={() => { setPicked(r); setNote(""); setError(""); }} className="flex w-full gap-3 rounded-[20px] border border-border bg-card p-4 text-start">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", r.status === "open" ? "bg-destructive-light text-destructive" : "bg-muted text-text-2")}><TriangleAlert className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">#{r.ref} {incidentLabel(r.category)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(r.created_at)}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-text-2">{r.description}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Guard {r.guard?.guard_number ?? "?"}{r.house_number ? ` · House ${r.house_number}${r.house_unit ? ` ${codeToUnit(r.house_unit)}` : ""}` : ""}{r.photo ? " · photo" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {rows && shown.length === 0 && !loadError && <li className="rounded-lg bg-muted p-6 text-center text-text-2">{filter === "open" ? "No open incidents." : "Nothing closed yet."}</li>}
        </ul>
      </Sheet>
      <ManagerTabs />

      <BottomSheet open={!!picked} onClose={() => !busy && setPicked(null)} title={picked ? `#${picked.ref} ${incidentLabel(picked.category)}` : ""}>
        {picked && (
          <div className="space-y-3 pb-4">
            <p className="text-sm text-muted-foreground">
              Guard {picked.guard?.guard_number} ({picked.guard?.full_name}) · Gate {picked.gate ?? 1} · {formatWhen(picked.created_at)}
              {picked.house_number ? ` · House ${picked.house_number}${picked.house_unit ? ` ${codeToUnit(picked.house_unit)}` : " (all units told)"}` : ""}
            </p>
            <p className="whitespace-pre-wrap text-base">{picked.description}</p>
            {picked.photo && <img src={picked.photo} alt="Photo from the guard" className="w-full rounded-2xl" />}
            {picked.status === "open" ? (
              <>
                <Field label="What was done? (optional)" placeholder="e.g. Spoke to the man, he left" value={note} onChange={(e) => setNote(e.target.value)} />
                {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <Button disabled={busy} onClick={close}>{busy ? "Closing…" : "Mark as closed"}</Button>
              </>
            ) : (
              <p className="rounded-2xl bg-mint-lightest p-3 text-sm text-deep">Closed {picked.closed_at ? formatWhen(picked.closed_at) : ""}{picked.manager_note ? `: ${picked.manager_note}` : "."}</p>
            )}
          </div>
        )}
      </BottomSheet>
    </Screen>
  );
}

export default ManagerIncidents;
