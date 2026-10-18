import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, Truck } from "lucide-react";
import { BottomSheet, Button, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { lagosDateInput } from "@/lib/expiry";
import { formatMoveDate, moveStatusLabel, type MoveOut } from "@/lib/moving";
import { codeToUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

export const title = "Moving out";

type Row = MoveOut & { resident: { full_name: string } | null };
type Starting = { id: string; full_name: string; house_number: string; house_unit: string };

/** Estate Manager: confirm or cancel moving-out requests, or start one for a household. */
function ManagerMoving() {
  const me = useManager();
  const location = useLocation();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState<Row | null>(null);
  const [starting, setStarting] = useState<Starting | null>(() => (location.state as { resident?: Starting } | null)?.resident ?? null);
  const [date, setDate] = useState(() => lagosDateInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("move_outs")
      .select("*, resident:profiles!move_outs_resident_id_fkey(full_name)")
      .order("move_date", { ascending: true })
      .limit(100);
    setLoadError(err ? "Moving out is not switched on yet. Please check back soon." : "");
    setRows((data ?? []) as unknown as Row[]);
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function act(fn: "confirm_move_out" | "cancel_move_out") {
    if (!picked) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc(fn, { p_id: picked.id });
    setBusy(false);
    if (err) return setError(err.message);
    setPicked(null);
    await load();
  }
  async function start() {
    if (!starting) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("manager_start_move_out", { p_resident: starting.id, p_date: date });
    setBusy(false);
    if (err) return setError(err.message);
    setStarting(null);
    await load();
  }

  if (!me) return null;
  const open = (rows ?? []).filter((r) => r.status === "requested" || r.status === "confirmed");
  const past = (rows ?? []).filter((r) => r.status === "done" || r.status === "cancelled").reverse().slice(0, 20);
  const today = lagosDateInput();

  const card = (r: Row) => (
    <li key={r.id}>
      <button onClick={() => { setError(""); setPicked(r); }} className="flex w-full items-center gap-3 rounded-[20px] border border-border bg-card p-4 text-start">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", r.status === "requested" ? "bg-gold-light text-gold-text" : "bg-mint-light text-deep")}>
          {r.status === "requested" ? <Truck className="size-5" /> : <CalendarCheck className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">House {r.house_number} · {codeToUnit(r.house_unit)}</span>
          <span className="block truncate text-sm text-text-2">{r.resident?.full_name ?? ""} · {formatMoveDate(r.move_date)}</span>
          <span className="block text-xs text-muted-foreground">{moveStatusLabel(r.status)}</span>
        </span>
      </button>
    </li>
  );

  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Moving out</h1>
        <p className="mt-1 text-deep-foreground/75">On the day: codes stop, staff and household members are removed, the unit is freed.</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        {loadError && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{loadError}</p>}
        <h2 className="text-lg font-bold">Coming up</h2>
        <ul className="space-y-3">{open.map(card)}</ul>
        {rows && open.length === 0 && !loadError && <p className="rounded-lg bg-muted p-5 text-center text-text-2">No moves planned. To start one, open a resident under Residents.</p>}
        {past.length > 0 && (
          <>
            <h2 className="pt-2 text-lg font-bold">Recent</h2>
            <ul className="space-y-3 opacity-80">{past.map(card)}</ul>
          </>
        )}
      </Sheet>
      <ManagerTabs />

      <BottomSheet open={!!picked} onClose={() => !busy && setPicked(null)} title={picked ? `House ${picked.house_number} · ${codeToUnit(picked.house_unit)}` : ""}>
        {picked && (
          <div className="space-y-3 pb-4">
            <p className="text-base"><b>{picked.resident?.full_name}</b> · {formatMoveDate(picked.move_date)}</p>
            {picked.note && <p className="text-sm text-text-2">“{picked.note}”</p>}
            <p className="text-sm text-text-2">{moveStatusLabel(picked.status)}{picked.done_at ? ` · ${new Date(picked.done_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}` : ""}</p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            {picked.status === "requested" && (
              <Button disabled={busy} onClick={() => act("confirm_move_out")}>{busy ? "Confirming…" : picked.move_date <= today ? "Confirm: it happens now" : "Confirm"}</Button>
            )}
            {(picked.status === "requested" || picked.status === "confirmed") && (
              <Button variant="outline" disabled={busy} onClick={() => act("cancel_move_out")}>Cancel this move</Button>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!starting} onClose={() => !busy && setStarting(null)} title={starting ? `Move out ${starting.full_name}` : ""}>
        {starting && (
          <div className="space-y-3 pb-4">
            <p className="text-text-2">House {starting.house_number} · {codeToUnit(starting.house_unit)}. Everyone in this unit is signed out and all its codes stop on the day.</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">Moving day</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-13 min-h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary" />
            </label>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button variant="danger" disabled={busy || !date} onClick={start}>{busy ? "Saving…" : date <= today ? "Move out now" : "Schedule the move"}</Button>
          </div>
        )}
      </BottomSheet>
    </Screen>
  );
}

export default ManagerMoving;
