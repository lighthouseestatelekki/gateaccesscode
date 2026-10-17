import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, Phone, Plus, Share2, UserMinus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ScheduleEditor, scheduleProblem } from "@/components/lh/ScheduleEditor";
import { formatCode } from "@/lib/expiry";
import { ALWAYS, describeSchedule, fromRow, toRpc, type Schedule } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";

export const title = "My staff";

type StaffCode = {
  id: string; code: string; holder_name: string; days_of_week: number[] | null; start_time: string | null;
  end_time: string | null; days_of_month: number[] | null; employee_id: string;
  employees: { id: string; full_name: string; phone: string | null; job_title: string } | null;
};

export async function shareStaffCode(c: { code: string; holder: string; job: string; schedule: Schedule; house: string; unit: string }) {
  const msg = `Assalam Alaekum ${c.holder}. Your staff access code for Lighthouse Estate Lekki is ${formatCode(c.code)} (${c.job}, House ${c.house} · ${c.unit}). It works: ${describeSchedule(c.schedule)}. Please show this code to the guard at the gate each time you come in and go out.`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: msg });
    } catch {
      /* cancelled */
    }
  } else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

function Staff() {
  const profile = useResident();
  const [list, setList] = useState<StaffCode[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [job, setJob] = useState("");
  const [sched, setSched] = useState<Schedule>(ALWAYS);
  const [editing, setEditing] = useState<StaffCode | null>(null);
  const [removing, setRemoving] = useState<StaffCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("access_codes")
      .select("id,code,holder_name,days_of_week,start_time,end_time,days_of_month,employee_id,employees(id,full_name,phone,job_title)")
      .eq("type", "employee")
      .eq("active", true)
      .order("created_at", { ascending: true });
    setList((data ?? []) as unknown as StaffCode[]);
  }, []);
  useEffect(() => {
    if (profile) load();
  }, [profile, load]);

  async function add() {
    if (name.trim().length < 2 || job.trim().length < 2) return setError("Please enter their name and job, e.g. Driver.");
    const p = scheduleProblem(sched);
    if (p) return setError(p);
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("add_employee", { p_full_name: name.trim(), p_phone: phone.trim(), p_job_title: job.trim(), ...toRpc(sched) });
    setBusy(false);
    if (err) return setError(err.message);
    setAdding(false);
    await load();
  }
  async function saveHours() {
    if (!editing) return;
    const p = scheduleProblem(sched);
    if (p) return setError(p);
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("set_employee_schedule", { p_code_id: editing.id, ...toRpc(sched) });
    setBusy(false);
    if (err) return setError(err.message);
    setEditing(null);
    await load();
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("remove_employee", { p_employee_id: removing.employee_id });
    setBusy(false);
    if (err) return setError(err.message);
    setRemoving(null);
    await load();
  }

  if (!profile) return null;
  const unit = codeToUnit(profile.house_unit);

  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">My staff</h1>
        <p className="mt-1 text-deep-foreground/70">Drivers, cleaners, cooks and others who come regularly. Each gets their own code.</p>
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={() => { setName(""); setPhone(""); setJob(""); setSched(ALWAYS); setError(""); setAdding(true); }}>
          <Plus className="size-5" /> Add staff
        </Button>
        {list && list.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No staff yet.</p>}
        <ul className="space-y-3">
          {(list ?? []).map((c) => {
            const s = fromRow(c);
            const jobTitle = c.employees?.job_title ?? "Staff";
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{c.holder_name}</p>
                    <p className="text-sm text-text-2">{jobTitle}{c.employees?.phone ? ` · ${c.employees.phone}` : ""}</p>
                  </div>
                  <p className="code-digits text-2xl font-bold text-deep">{formatCode(c.code)}</p>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" />{describeSchedule(s)}</p>
                <div className="mt-3 flex gap-2">
                  <button aria-label={`Share code with ${c.holder_name}`} onClick={() => shareStaffCode({ code: c.code, holder: c.holder_name, job: jobTitle, schedule: s, house: profile.house_number, unit })} className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"><Share2 className="size-5" /></button>
                  {c.employees?.phone && <a aria-label={`Call ${c.holder_name}`} href={`tel:${c.employees.phone}`} className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"><Phone className="size-5" /></a>}
                  <button onClick={() => { setSched(s); setError(""); setEditing(c); }} className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold">Change hours</button>
                  <button aria-label={`Remove ${c.holder_name}`} onClick={() => { setError(""); setRemoving(c); }} className="flex size-11 items-center justify-center rounded-sm border border-border text-destructive"><UserMinus className="size-5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <BottomSheet open={adding} onClose={() => !busy && setAdding(false)} title="Add staff">
        <div className="space-y-4 pb-4">
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Job" placeholder="e.g. Driver, Cleaner, Cook" value={job} onChange={(e) => setJob(e.target.value)} />
          <Field label="Phone (optional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div>
            <p className="mb-2 text-sm font-medium text-text-2">When can they come in?</p>
            <ScheduleEditor value={sched} onChange={setSched} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={add}>{busy ? "Adding…" : "Add and create code"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!editing} onClose={() => !busy && setEditing(null)} title={editing ? `${editing.holder_name}'s hours` : ""}>
        <div className="space-y-4 pb-4">
          <ScheduleEditor value={sched} onChange={setSched} />
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={saveHours}>{busy ? "Saving…" : "Save hours"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!removing} onClose={() => !busy && setRemoving(null)} title={removing ? `Remove ${removing.holder_name}?` : ""}>
        <div className="space-y-3 pb-4">
          <p className="text-base text-text-2">Their code will stop working straight away.</p>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button variant="danger" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Yes, remove"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Keep</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Staff;
