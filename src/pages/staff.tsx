import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, Link2, Phone, Plus, Share2, UserMinus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { DEFAULT_SCHEDULE, ScheduleEditor, scheduleProblem } from "@/components/lh/ScheduleEditor";
import { cn } from "@/lib/utils";
import { formatCode, gateMessage, shareText } from "@/lib/expiry";
import { ALWAYS, describeSchedule, fromRow, toRpc, type Schedule } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { ResidentTabs } from "@/components/lh/nav";
import { useResident } from "@/lib/useResident";
import { Initial } from "@/components/lh/CodeTicket";
import { inviteUrl, kinLabel, shareStaffInvite, STAFF_COLUMNS, type StaffDetails } from "@/lib/staffOnboarding";

export const title = "My staff";

const JOBS = ["Driver", "Cleaner", "Cook", "Nanny", "Gardener", "Other"] as const;

type StaffCode = {
  id: string; code: string; holder_name: string; days_of_week: number[] | null; start_time: string | null;
  end_time: string | null; days_of_month: number[] | null; employee_id: string;
  employees: StaffDetails | null;
};

export async function shareStaffCode(c: { code: string; holder: string; job: string; schedule: Schedule; host: string; house: string; unit: string }) {
  const msg = gateMessage({
    code: c.code, hostName: c.host, houseNumber: c.house, unitLabel: c.unit,
    whenLine: `Staff code (${c.job}), works: ${describeSchedule(c.schedule)}`,
    extra: "Use this same code each time you come in and go out.",
  });
  return shareText(msg);
}

function Staff() {
  const profile = useResident();
  const [list, setList] = useState<StaffCode[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [job, setJob] = useState("Driver");
  const [otherJob, setOtherJob] = useState("");
  const [sched, setSched] = useState<Schedule>(ALWAYS);
  const [editing, setEditing] = useState<StaffCode | null>(null);
  const [removing, setRemoving] = useState<StaffCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewing, setReviewing] = useState<StaffCode | null>(null);
  const [sendBack, setSendBack] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("access_codes")
      .select(`id,code,holder_name,days_of_week,start_time,end_time,days_of_month,employee_id,employees(${STAFF_COLUMNS})`)
      .eq("type", "employee")
      .eq("active", true)
      .order("created_at", { ascending: true });
    setList((data ?? []) as unknown as StaffCode[]);
  }, []);
  useEffect(() => {
    if (profile) load();
  }, [profile, load]);

  async function add() {
    const jobTitle = job === "Other" ? otherJob.trim() : job;
    if (name.trim().length < 2 || jobTitle.length < 2) return setError("Please enter their name and job, e.g. Driver.");
    const p = scheduleProblem(sched);
    if (p) return setError(p);
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("add_employee", { p_full_name: name.trim(), p_phone: phone.trim(), p_job_title: jobTitle, ...toRpc(sched) });
    setBusy(false);
    if (err) return setError(err.message);
    setAdding(false);
    const tok = (data as { invite?: string } | null)?.invite;
    if (tok) { setCopied(false); setInvite({ token: tok, name: name.trim() }); }
    await load();
  }
  async function newLink(c: StaffCode) {
    setError("");
    const { data, error: err } = await supabase.rpc("new_staff_invite", { p_employee_id: c.employee_id });
    if (err) return setError(err.message);
    setCopied(false);
    setInvite({ token: data as string, name: c.holder_name });
    await load();
  }
  async function review(approve: boolean) {
    if (!reviewing) return;
    if (!approve && note.trim().length < 3) return setError("Please say what they should fix.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("review_staff", { p_employee_id: reviewing.employee_id, p_approve: approve, p_note: approve ? null : note.trim() });
    setBusy(false);
    if (err) return setError(err.message);
    setReviewing(null);
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
        <h1 className="pt-2 text-3xl font-semibold">My staff</h1>
        <p className="mt-1 text-deep-foreground/70">Drivers, cleaners, cooks and others who come regularly. Each gets their own code.</p>
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={() => { setName(""); setPhone(""); setJob("Driver"); setOtherJob(""); setSched(DEFAULT_SCHEDULE); setError(""); setAdding(true); }}>
          <Plus className="size-5" /> Add staff
        </Button>
        {error && !adding && !editing && !removing && !reviewing && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {list && list.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No staff yet.</p>}
        <ul className="space-y-3">
          {(list ?? []).map((c) => {
            const s = fromRow(c);
            const jobTitle = c.employees?.job_title ?? "Staff";
            const e = c.employees;
            const approved = !!e?.approved_at;
            const stage = e?.onboarding ?? "none";
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    {e?.photo ? <img src={e.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" /> : <Initial name={c.holder_name} className="size-12 shrink-0 text-lg" />}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{c.holder_name}</p>
                      <p className="truncate text-sm text-text-2">{jobTitle}{e?.phone ? ` · ${e.phone}` : ""}</p>
                    </div>
                  </div>
                  {approved ? <p className="code-digits shrink-0 text-2xl font-bold text-deep">{formatCode(c.code)}</p> : <span className="shrink-0 rounded-full bg-gold-light px-2.5 py-1 text-xs font-bold text-gold-text">Not active yet</span>}
                </div>
                {stage === "submitted" && (
                  <button onClick={() => { setError(""); setSendBack(false); setNote(""); setReviewing(c); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-deep-dark"><CheckCircle2 className="size-5" /> Review their details</button>
                )}
                {stage === "invited" && (
                  <div className="mt-3 rounded-2xl bg-mint-lightest p-3">
                    <p className="text-sm font-semibold text-deep">{e?.review_note ? "Sent back to fix: " + e.review_note : "Waiting for them to fill in their details"}</p>
                    <button onClick={() => newLink(c)} className="mt-2 flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-deep ring-1 ring-border"><Link2 className="size-4" /> Send the link again</button>
                  </div>
                )}
                {approved && stage === "none" && (
                  <button onClick={() => newLink(c)} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-deep"><Link2 className="size-4" /> Ask for their photo and ID</button>
                )}
                {approved && e?.id_last4 && <p className="mt-2 text-xs text-muted-foreground">{e.id_type} ending {e.id_last4} · {kinLabel(e.kin_kind)}: {e.kin_name}</p>}
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" />{describeSchedule(s)}</p>
                <div className="mt-3 flex gap-2">
                  {approved && <button aria-label={`Share code with ${c.holder_name}`} onClick={() => shareStaffCode({ code: c.code, holder: c.holder_name, job: jobTitle, schedule: s, host: profile.full_name, house: profile.house_number, unit })} className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"><Share2 className="size-5" /></button>}
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
          <p className="rounded-2xl bg-mint-lightest p-3 text-sm text-deep">You'll get a link to send them. They add their own photo, ID and next of kin. Their code works once you approve.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Phone (optional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-2">Job</p>
            <div role="radiogroup" aria-label="Job" className="grid grid-cols-3 gap-2">
              {JOBS.map((j) => (
                <button key={j} type="button" role="radio" aria-checked={job === j} onClick={() => setJob(j)} className={cn("min-h-11 rounded-2xl border-[1.5px] text-sm font-semibold", job === j ? "border-primary bg-mint-light text-deep" : "border-border bg-card text-text-2")}>{j}</button>
              ))}
            </div>
            {job === "Other" && <div className="mt-2"><Field label="Their job" placeholder="e.g. Security, Tutor" value={otherJob} onChange={(e) => setOtherJob(e.target.value)} /></div>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-2">When can they come in?</p>
            <ScheduleEditor key={adding ? "add-open" : "add"} value={sched} onChange={setSched} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={add}>{busy ? "Adding…" : "Add and get their link"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!editing} onClose={() => !busy && setEditing(null)} title={editing ? `${editing.holder_name}'s hours` : ""}>
        <div className="space-y-4 pb-4">
          <ScheduleEditor key={editing?.id ?? "none"} value={sched} onChange={setSched} />
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
      <BottomSheet open={!!invite} onClose={() => setInvite(null)} title={invite ? `Send ${invite.name.split(/\s+/)[0]} their link` : ""}>
        {invite && (
          <div className="space-y-3 pb-4">
            <p className="text-text-2">They open it on their own phone, take a photo of their face, and add their ID and a next of kin or guarantor. You'll get an alert to review it. The link works for 7 days.</p>
            <Button onClick={() => shareStaffInvite({ token: invite.token, staffName: invite.name, house: profile.house_number, unit })}><Share2 className="size-5" /> Send on WhatsApp</Button>
            <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(inviteUrl(invite.token)); setCopied(true); }}><Copy className="size-5" /> {copied ? "Link copied" : "Copy link"}</Button>
            <p className="text-center text-xs text-muted-foreground">Keep this link private. Anyone with it can fill in the form.</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!reviewing} onClose={() => !busy && setReviewing(null)} title={reviewing ? `Check ${reviewing.employees?.full_name ?? reviewing.holder_name}` : ""}>
        {reviewing?.employees && (() => {
          const e = reviewing.employees;
          const rows: [string, string][] = [
            ["Full name", e.full_name], ["Phone", e.phone ?? "—"], ["Job", e.job_title],
            ["ID", `${e.id_type ?? "—"} ending ${e.id_last4 ?? "—"}`],
            [kinLabel(e.kin_kind), `${e.kin_name ?? "—"}${e.kin_relation ? ` (${e.kin_relation})` : ""}`],
            [`${kinLabel(e.kin_kind)}'s phone`, e.kin_phone ?? "—"],
          ];
          return (
            <div className="space-y-4 pb-4">
              {e.photo && <img src={e.photo} alt={`Photo of ${e.full_name}`} className="mx-auto size-44 rounded-3xl object-cover" />}
              <dl className="divide-y divide-border rounded-2xl border border-border">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><dt className="text-text-2">{k}</dt><dd className="text-end font-semibold">{v}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">Tip: ask to see their ID card and check the last 4 digits match. Call the {kinLabel(e.kin_kind).toLowerCase()} if you are not sure.</p>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              {sendBack ? (
                <>
                  <Field label="What should they fix?" placeholder="e.g. Photo is blurry" value={note} onChange={(ev) => setNote(ev.target.value)} />
                  <Button variant="secondary" disabled={busy} onClick={() => review(false)}>{busy ? "Sending…" : "Send back to fix"}</Button>
                </>
              ) : (
                <>
                  <Button disabled={busy} onClick={() => review(true)}><CheckCircle2 className="size-5" /> {busy ? "Approving…" : "Approve: code starts working"}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => setSendBack(true)}>Something is wrong, send back</Button>
                </>
              )}
            </div>
          );
        })()}
      </BottomSheet>
      <ResidentTabs />
    </Screen>
  );
}

export default Staff;
