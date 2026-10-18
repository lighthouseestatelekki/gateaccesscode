import { useCallback, useEffect, useState } from "react";
import { Clock, LogIn, MessageSquareText } from "lucide-react";
import { BottomSheet, Button } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { formatWhen } from "@/lib/when";

type Handover = { note: string; at: string; guard_number: string };
type ShiftState = { on_duty: boolean; started_at: string | null; handover: Handover | null };

function since(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Guard's shift: Clock in at the start, clock out at the end with a note for the next guard. */
export function ShiftBar() {
  const [state, setState] = useState<ShiftState | null>(null);
  const [off, setOff] = useState(false); // shifts not switched on yet
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [showHandover, setShowHandover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = useCallback((data: unknown) => setState(data as ShiftState), []);
  useEffect(() => {
    supabase.rpc("guard_shift_state").then(({ data, error: err }) => (err ? setOff(true) : apply(data)));
  }, [apply]);

  async function call(fn: string, args?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc(fn, args);
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    apply(data);
    return true;
  }

  if (off || !state) return null;

  if (!state.on_duty) {
    return (
      <div className="mt-4 rounded-2xl bg-gold p-3 text-deep-dark">
        <p className="font-bold">You are not clocked in</p>
        {state.handover && <p className="mt-1 text-sm">Note from Guard {state.handover.guard_number}: “{state.handover.note}”</p>}
        <button disabled={busy} onClick={async () => { if (await call("guard_clock_in")) setShowHandover(!!state.handover); }} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-deep-dark font-bold text-gold disabled:opacity-60">
          <LogIn className="size-5" /> {busy ? "Clocking in…" : "Clock in to start your shift"}
        </button>
        {error && <p role="alert" className="mt-1 text-sm font-semibold">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
        <Clock className="size-4 text-gold" />
        <p className="flex-1 text-sm font-semibold">On duty {state.started_at ? `· ${since(state.started_at)}` : ""}</p>
        {state.handover && <button aria-label="Handover note" onClick={() => setShowHandover(true)} className="flex size-9 items-center justify-center rounded-full bg-white/10"><MessageSquareText className="size-4" /></button>}
        <button onClick={() => { setNote(""); setError(""); setClosing(true); }} className="min-h-9 rounded-full bg-white/15 px-3 text-sm font-semibold">Clock out</button>
      </div>

      <BottomSheet open={showHandover && !!state.handover} onClose={() => setShowHandover(false)} title="Handover note">
        {state.handover && (
          <div className="space-y-3 pb-4">
            <p className="rounded-2xl bg-mint-lightest p-4 text-lg text-deep">“{state.handover.note}”</p>
            <p className="text-sm text-text-2">From Guard {state.handover.guard_number}, {formatWhen(state.handover.at)}.</p>
            <Button onClick={() => setShowHandover(false)}>OK</Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={closing} onClose={() => !busy && setClosing(false)} title="Clock out">
        <div className="space-y-3 pb-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-2">Note for the next guard (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="e.g. Gate light is faulty. House 22 expecting a truck at 8am." className="w-full rounded-2xl border-[1.5px] border-border bg-card p-3 text-base text-foreground outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={async () => { if (await call("guard_clock_out", { p_note: note.trim() || null })) setClosing(false); }}>{busy ? "Clocking out…" : "Clock out"}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
