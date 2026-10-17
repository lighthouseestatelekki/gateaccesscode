import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, Plus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, ManagerTabs, Screen, Sheet, StatusChip } from "@/components/lh/ui";
import { ScheduleEditor, scheduleProblem } from "@/components/lh/ScheduleEditor";
import { formatCode, formatValidity } from "@/lib/expiry";
import { describeSchedule, fromRow, toRpc, type Schedule } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { cn } from "@/lib/utils";

export const title = "House codes";

type Resident = { id: string; full_name: string; phone: string | null; house_number: string; house_unit: string };
type Code = {
  id: string; code: string; type: string; holder_name: string; valid_from: string; valid_to: string | null; active: boolean;
  used_at: string | null; days_of_week: number[] | null; start_time: string | null; end_time: string | null; days_of_month: number[] | null;
  employees: { job_title: string } | null;
};

const HOUR = 3600_000;
/** Date -> "YYYY-MM-DDTHH:MM" in Lagos time for a datetime-local input. */
const toLocal = (iso: string | Date) => new Date(new Date(iso).getTime() + HOUR).toISOString().slice(0, 16);
/** "YYYY-MM-DDTHH:MM" typed as Lagos time -> Date */
const fromLocal = (v: string) => new Date(`${v}:00+01:00`);

function statusOf(c: Code): "Active" | "Used" | "Expired" | "Cancelled" {
  if (c.used_at) return "Used";
  if (!c.active) return "Cancelled";
  if (c.valid_to && new Date(c.valid_to).getTime() <= Date.now()) return "Expired";
  return "Active";
}

const typeLabel = (c: Code) => (c.type === "employee" ? `Staff · ${c.employees?.job_title ?? ""}` : c.type === "long_stay" ? "Long stay" : "One visit");
const input = "h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

function House() {
  const me = useManager();
  const { id } = useParams();
  const [res, setRes] = useState<Resident | null>(null);
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [cType, setCType] = useState<"guest" | "long_stay">("guest");
  const [cName, setCName] = useState("");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [dates, setDates] = useState<Code | null>(null);
  const [hours, setHours] = useState<Code | null>(null);
  const [sched, setSched] = useState<Schedule>({ days: null, start: null, end: null, dom: null });

  const load = useCallback(async () => {
    if (!id) return;
    const { data: r } = await supabase.from("profiles").select("id,full_name,phone,house_number,house_unit").eq("id", id).single();
    setRes(r as Resident);
    const { data } = await supabase
      .from("access_codes")
      .select("id,code,type,holder_name,valid_from,valid_to,active,used_at,days_of_week,start_time,end_time,days_of_month,employees(job_title)")
      .eq("issued_by", id)
      .order("created_at", { ascending: false })
      .limit(100);
    setCodes((data ?? []) as unknown as Code[]);
  }, [id]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function run(fn: string, args: Record<string, unknown>, after: () => void) {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc(fn, args);
    setBusy(false);
    if (err) return setError(err.message);
    after();
    await load();
  }

  if (!me) return null;
  const list = (codes ?? []).filter((c) => showAll || statusOf(c) === "Active");

  return (
    <Screen>
      <Hero>
        <Link to="/manager/residents" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">{res ? `House ${res.house_number}` : " "}</h1>
        {res && <p className="mt-1 text-deep-foreground/70">{codeToUnit(res.house_unit)} · {res.full_name}</p>}
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={() => { setCType("guest"); setCName(""); setCFrom(toLocal(new Date())); setCTo(toLocal(new Date(Date.now() + 4 * HOUR))); setError(""); setCreating(true); }}>
          <Plus className="size-5" /> Create a code for this house
        </Button>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{showAll ? "All codes" : "Active codes"}</h2>
          <button onClick={() => setShowAll(!showAll)} className="min-h-11 text-sm font-bold text-primary">{showAll ? "Active only" : "Show all"}</button>
        </div>
        {error && !creating && !dates && !hours && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {codes && list.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No {showAll ? "" : "active "}codes.</p>}
        <ul className="space-y-3">
          {list.map((c) => {
            const st = statusOf(c);
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("code-digits text-2xl font-bold", st === "Active" ? "text-deep" : "text-muted-foreground")}>{formatCode(c.code)}</p>
                  <StatusChip status={st} />
                </div>
                <p className="mt-1 font-medium">{c.holder_name} <span className="text-sm font-normal text-text-2">· {typeLabel(c)}</span></p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {c.type === "employee" ? (<><Clock className="size-4" />{describeSchedule(fromRow(c))}</>) : c.valid_to ? formatValidity({ type: c.type, valid_from: c.valid_from, valid_to: c.valid_to }) : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  {c.type === "employee" && c.active && (
                    <button onClick={() => { setSched(fromRow(c)); setError(""); setHours(c); }} className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold">Change hours</button>
                  )}
                  {c.type !== "employee" && !c.used_at && (
                    <button onClick={() => { setCFrom(toLocal(c.valid_from)); setCTo(toLocal(c.valid_to ?? new Date())); setError(""); setDates(c); }} className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold">Change dates</button>
                  )}
                  {!c.used_at && (
                    <button disabled={busy} onClick={() => run("manager_set_code_active", { p_code_id: c.id, p_active: !c.active }, () => {})} className={cn("min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold", c.active ? "text-destructive" : "text-deep")}>
                      {c.active ? "Switch off" : "Switch on"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>
      <ManagerTabs />

      <BottomSheet open={creating} onClose={() => !busy && setCreating(false)} title={res ? `New code for House ${res.house_number}` : "New code"}>
        <div className="space-y-4 pb-4">
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {([["guest", "One visit"], ["long_stay", "Long stay"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={cType === k} onClick={() => setCType(k)} className={cn("min-h-12 rounded-xl font-semibold", cType === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>{l}</button>
            ))}
          </div>
          <Field label="Visitor name" value={cName} onChange={(e) => setCName(e.target.value)} />
          <div className="grid grid-cols-1 gap-3">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-text-2">Starts</span><input type="datetime-local" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={input} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-text-2">Ends</span><input type="datetime-local" value={cTo} onChange={(e) => setCTo(e.target.value)} className={input} /></label>
          </div>
          <p className="text-sm text-muted-foreground">The resident gets a notice and sees this code in their list.</p>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={() => {
            if (!res || !cName.trim() || !cFrom || !cTo) return setError("Please fill in the name, start and end.");
            run("manager_create_code", { p_house_number: res.house_number, p_house_unit: res.house_unit, p_type: cType, p_holder_name: cName.trim(), p_valid_from: fromLocal(cFrom).toISOString(), p_valid_to: fromLocal(cTo).toISOString() }, () => setCreating(false));
          }}>{busy ? "Creating…" : "Create code"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!dates} onClose={() => !busy && setDates(null)} title={dates ? `Change dates · ${dates.holder_name}` : ""}>
        <div className="space-y-4 pb-4">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-text-2">Starts</span><input type="datetime-local" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={input} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-text-2">Ends</span><input type="datetime-local" value={cTo} onChange={(e) => setCTo(e.target.value)} className={input} /></label>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={() => dates && run("manager_change_code_dates", { p_code_id: dates.id, p_valid_from: fromLocal(cFrom).toISOString(), p_valid_to: fromLocal(cTo).toISOString() }, () => setDates(null))}>{busy ? "Saving…" : "Save dates"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!hours} onClose={() => !busy && setHours(null)} title={hours ? `${hours.holder_name}'s hours` : ""}>
        <div className="space-y-4 pb-4">
          <ScheduleEditor value={sched} onChange={setSched} />
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={() => {
            const p = scheduleProblem(sched);
            if (p) return setError(p);
            if (hours) run("set_employee_schedule", { p_code_id: hours.id, ...toRpc(sched) }, () => setHours(null));
          }}>{busy ? "Saving…" : "Save hours"}</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default House;
