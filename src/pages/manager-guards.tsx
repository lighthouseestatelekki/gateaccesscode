import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, Keypad, ManagerTabs, PinBoxes, Screen, Sheet, usePin } from "@/components/lh/ui";
import { isWeakPin } from "@/lib/pin";
import { staffAdmin } from "@/lib/staffAdmin";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { SignOutEverywhere } from "@/components/lh/SignOutEverywhere";

export const title = "Guards";

type Guard = { id: string; full_name: string; guard_number: string; assigned_gate: number; status: string };
type Shift = { id: string; guard_id: string; started_at: string; ended_at: string | null; handover_note: string | null; auto_closed: boolean };

const hours = (s: Shift, now = Date.now()) => ((s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime()) / 3_600_000;
const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });

function Guards() {
  const me = useManager();
  const [list, setList] = useState<Guard[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [num, setNum] = useState("");
  const pin = usePin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [suggested, setSuggested] = useState("");
  const [picked, setPicked] = useState<Guard | null>(null);
  const [resetTemp, setResetTemp] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  async function resetGuardPin(g: Guard) {
    setBusy(true);
    setError("");
    try {
      const r = await staffAdmin<{ temp_pin: string }>({ action: "reset_pin", profile_id: g.id });
      setResetTemp(r.temp_pin);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function suggestPin() {
    let p = "";
    do p = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
    while (isWeakPin(p));
    pin.reset();
    for (const d of p) pin.onDigit(d);
    setSuggested(p);
  }

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("profiles").select("id,full_name,guard_number,assigned_gate,status").eq("role", "guard");
    if (err) setError(err.message);
    const rows = (data ?? []) as Guard[];
    rows.sort((a, b) => Number(a.guard_number) - Number(b.guard_number));
    setList(rows);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: sh } = await supabase.from("guard_shifts").select("id,guard_id,started_at,ended_at,handover_note,auto_closed").or(`started_at.gte.${since},ended_at.is.null`).order("started_at", { ascending: false });
    setShifts((sh ?? []) as Shift[]);
  }, []);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  function openSheet() {
    setName("");
    setPhone("");
    // Suggest the next guard number after the highest one in use.
    const highest = Math.max(0, ...(list ?? []).map((g) => Number(g.guard_number) || 0));
    setNum(String(highest + 1));
    pin.reset();
    setSuggested("");
    setError("");
    setOpen(true);
  }

  async function addGuard() {
    if (name.trim().length < 2 || !num) {
      setError("Please enter the guard's full name and guard number.");
      return;
    }
    if (pin.value.length !== 6 || isWeakPin(pin.value)) {
      setError("Please choose a 6-digit PIN that is not easy to guess.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await staffAdmin({ action: "create_guard", full_name: name.trim(), phone: phone.trim(), guard_number: num, pin: pin.value });
      setOpen(false);
      setDone(`Guard ${Number(num)} added. They sign in with guard number ${Number(num)} and the PIN you chose.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (!me) return null;

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Guards</h1>
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={openSheet}><Plus className="size-5" /> Add guard</Button>
        {done && <p role="status" className="rounded-lg bg-mint-lightest p-3 text-sm font-medium text-deep">{done}</p>}
        <ul className="divide-y divide-border">
          {(list ?? []).map((g) => (
            <li key={g.id}>
             <button onClick={() => { setPicked(g); setResetTemp(""); setError(""); }} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
              <span className="flex size-11 items-center justify-center rounded-full bg-deep font-display font-semibold text-deep-foreground">{g.guard_number}</span>
              <span className="flex-1"><span className="block font-semibold">Guard {g.guard_number}</span><span className="block text-sm text-text-2">{g.full_name} · Gate {g.assigned_gate}</span></span>
              {g.status !== "active" ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize text-text-2">{g.status}</span>
              ) : shifts.some((s) => s.guard_id === g.id && !s.ended_at) ? (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">On duty</span>
              ) : (
                <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-semibold text-deep">Off duty</span>
              )}
             </button>
            </li>
          ))}
          {list && list.length === 0 && <li className="py-6 text-center text-text-2">No guards yet.</li>}
        </ul>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={!!picked} onClose={() => !busy && setPicked(null)} title={picked ? `Guard ${picked.guard_number} · ${picked.full_name}` : ""}>
        {picked && (
          <div className="space-y-3 pb-4">
            {(() => {
              const mine = shifts.filter((s) => s.guard_id === picked.id);
              const total = mine.reduce((t, s) => t + hours(s), 0);
              return (
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-sm font-semibold">Last 7 days: {total.toFixed(1)} hours · {mine.length} shift{mine.length === 1 ? "" : "s"}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-text-2">
                    {mine.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        {fmtTime(s.started_at)} → {s.ended_at ? fmtTime(s.ended_at) : <b className="text-primary">on duty now</b>}
                        {s.auto_closed && <span className="text-gold-text"> (forgot to clock out)</span>}
                        {s.handover_note && <span className="block text-xs italic text-muted-foreground">“{s.handover_note}”</span>}
                      </li>
                    ))}
                    {mine.length === 0 && <li>No shifts yet.</li>}
                  </ul>
                </div>
              );
            })()}
            {resetTemp ? (
              <div className="space-y-2 text-center">
                <p className="code-digits rounded-2xl bg-mint-lightest py-5 text-4xl font-bold text-deep">{resetTemp.slice(0, 3)} {resetTemp.slice(3)}</p>
                <p className="text-sm text-text-2">Temporary PIN. The guard chooses their own at next sign-in.</p>
              </div>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => resetGuardPin(picked)}>{busy ? "Resetting…" : "Reset PIN"}</Button>
            )}
            <SignOutEverywhere key={picked.id} userId={picked.id} name={`Guard ${picked.guard_number}`} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={open} onClose={() => !busy && setOpen(false)} title="Add guard">
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guard number" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <div><p className="mb-1.5 text-sm font-medium text-text-2">Gate</p><p className="flex h-12 items-center rounded-2xl bg-muted px-4 font-medium">Gate 1</p></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-2">PIN</p>
                <p className="text-xs text-muted-foreground">6 digits, not easy to guess.</p>
              </div>
              <button type="button" onClick={suggestPin} className="min-h-10 rounded-full bg-mint-light px-4 text-sm font-semibold text-deep">Suggest a PIN</button>
            </div>
            {suggested && pin.value === suggested ? (
              <p className="rounded-2xl bg-gold-light px-4 py-3 text-center"><span className="code-digits text-2xl font-bold text-gold-text">{suggested.slice(0, 3)} {suggested.slice(3)}</span><span className="block text-xs text-gold-text">Give this PIN to the guard.</span></p>
            ) : (
              <PinBoxes value={pin.value} />
            )}
            <Keypad onDigit={(d) => { setSuggested(""); pin.onDigit(d); }} onBack={() => { setSuggested(""); pin.onBack(); }} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={addGuard}>{busy ? "Adding…" : "Add guard"}</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Guards;
