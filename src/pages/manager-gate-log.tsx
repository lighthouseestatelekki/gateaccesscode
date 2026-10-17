import { useCallback, useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { BottomSheet, Button, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { formatCode } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { cn } from "@/lib/utils";

export const title = "Gate log";

type Code = { id: string; code: string; holder_name: string; house_number: string; house_unit: string; active: boolean; type: string };
type LogRow = {
  id: string; attempted_code: string; direction: string | null; result: "access" | "expired" | "denied";
  reason: string | null; scanned_at: string; night_access: boolean; access_codes: Code | null;
};

const HOUR = 3600_000;
/** Start of a Lagos calendar day (daysAgo = 0 today, 1 yesterday) as a UTC instant. */
function lagosDayStart(daysAgo: number, now = new Date()) {
  const l = new Date(now.getTime() + HOUR);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - daysAgo) - HOUR);
}
function lagosTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + HOUR);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const chip = {
  access: "bg-mint-light text-deep",
  expired: "bg-gold-light text-gold-text",
  denied: "bg-destructive-light text-destructive",
};

function label(r: LogRow) {
  if (r.result === "access") return r.direction === "out" ? "OUT" : "IN";
  return r.result === "expired" ? "EXPIRED" : "DENIED";
}

function GateLog() {
  const me = useManager();
  const [day, setDay] = useState<0 | 1>(0);
  const [nightOnly, setNightOnly] = useState(false);
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const load = useCallback(async () => {
    const from = lagosDayStart(day);
    const to = new Date(from.getTime() + 24 * HOUR);
    let q = supabase
      .from("gate_logs")
      .select("id,attempted_code,direction,result,reason,scanned_at,night_access,access_codes(id,code,holder_name,house_number,house_unit,active,type)")
      .gte("scanned_at", from.toISOString())
      .lt("scanned_at", to.toISOString())
      .order("scanned_at", { ascending: false })
      .limit(300);
    if (nightOnly) q = q.eq("night_access", true);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else {
      setError("");
      setRows((data ?? []) as unknown as LogRow[]);
    }
  }, [day, nightOnly]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function switchOff() {
    if (!target) return;
    setBusy(true);
    setSheetError("");
    const { error: err } = await supabase.rpc("manager_switch_off_code", { p_code_id: target.id });
    setBusy(false);
    if (err) {
      setSheetError(err.message);
      return;
    }
    setTarget(null);
    await load();
  }

  if (!me) return null;

  const pill = (on: boolean) => cn("min-h-11 rounded-full px-4 text-sm font-semibold", on ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2");

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Gate log</h1>
        <p className="mt-1 text-sm text-deep-foreground/70">Every code typed at the gate, newest first.</p>
      </Hero>
      <Sheet className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={pill(day === 0)} onClick={() => setDay(0)}>Today</button>
          <button className={pill(day === 1)} onClick={() => setDay(1)}>Yesterday</button>
          <button className={pill(nightOnly)} onClick={() => setNightOnly(!nightOnly)}>
            <Moon className="mr-1 inline size-4" />Night only
          </button>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {rows && rows.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No gate activity{nightOnly ? " at night" : ""} {day === 0 ? "today" : "yesterday"}.</p>}
        <ul className="divide-y divide-border">
          {(rows ?? []).map((r) => {
            const c = r.access_codes;
            return (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-text-2">{lagosTime(r.scanned_at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", chip[r.result])}>{label(r)}</span>
                    {r.night_access && <span className="flex items-center gap-1 text-xs font-semibold text-text-2"><Moon className="size-3.5" />Night</span>}
                  </span>
                  {c ? (
                    <>
                      <span className="mt-1 block font-semibold">{c.holder_name}</span>
                      <span className="block text-sm text-text-2">House {c.house_number} · {codeToUnit(c.house_unit)} · {formatCode(c.code)}</span>
                    </>
                  ) : (
                    <span className="mt-1 block text-sm text-text-2">Code {r.attempted_code || "—"}</span>
                  )}
                  {r.result !== "access" && r.reason && <span className="block text-sm text-text-2">{r.reason}</span>}
                </span>
                {c?.active && (
                  <button onClick={() => { setSheetError(""); setTarget(c); }} className="min-h-11 shrink-0 rounded-sm border border-border px-3 text-sm font-semibold text-destructive">
                    Switch off
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={!!target} onClose={() => !busy && setTarget(null)} title="Switch off this code?">
        {target && (
          <div className="space-y-3 pb-4">
            <p className="text-base text-text-2">
              {target.holder_name} (House {target.house_number} · {codeToUnit(target.house_unit)}) will not be able to use code {formatCode(target.code)} again.
            </p>
            {sheetError && <p role="alert" className="text-sm font-medium text-destructive">{sheetError}</p>}
            <Button variant="danger" disabled={busy} onClick={switchOff}>{busy ? "Switching off…" : "Yes, switch off"}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Keep code</Button>
          </div>
        )}
      </BottomSheet>
    </Screen>
  );
}

export default GateLog;
