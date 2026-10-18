import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, Truck } from "lucide-react";
import { Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ResidentTabs } from "@/components/lh/nav";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";
import { useMe } from "@/lib/useMe";
import { lagosDateInput } from "@/lib/expiry";
import { formatMoveDate, moveStatusLabel, type MoveOut } from "@/lib/moving";
import { codeToUnit } from "@/lib/units";

export const title = "Moving out";

/** The main resident tells the estate they are moving out; the Estate Manager confirms. */
function Moving() {
  const profile = useResident();
  const me = useMe();
  const [open, setOpen] = useState<MoveOut | null | undefined>(undefined);
  const [isMain, setIsMain] = useState<boolean | null>(null);
  const [date, setDate] = useState(() => lagosDateInput(new Date(), 7));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("move_outs").select("*").in("status", ["requested", "confirmed"]).order("created_at", { ascending: false }).limit(1);
    setLoadError(err ? "Moving out is not switched on yet. Please check back soon." : "");
    setOpen(((data ?? [])[0] as MoveOut | undefined) ?? null);
  }, []);
  useEffect(() => {
    if (!profile || !me) return;
    load();
    supabase.from("profiles").select("household_role").eq("id", me.id).maybeSingle().then(({ data }) => setIsMain((data as { household_role?: string } | null)?.household_role !== "member"));
  }, [profile, me, load]);

  async function request() {
    if (!date) return setError("Please choose your moving day.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("request_move_out", { p_date: date, p_note: note.trim() || null });
    setBusy(false);
    if (err) return setError(err.message);
    await load();
  }
  async function cancel() {
    if (!open) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("cancel_move_out", { p_id: open.id });
    setBusy(false);
    if (err) return setError(err.message);
    await load();
  }

  if (!profile) return null;

  return (
    <Screen>
      <Hero>
        <Link to="/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Moving out</h1>
        <p className="mt-1 text-deep-foreground/75">House {profile.house_number} · {codeToUnit(profile.house_unit)}</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        {loadError && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{loadError}</p>}

        {open ? (
          <div className="space-y-3 rounded-[22px] border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-mint-light text-deep"><CalendarCheck className="size-5" /></span>
              <div>
                <p className="text-lg font-semibold">{formatMoveDate(open.move_date)}</p>
                <p className="text-sm text-text-2">{moveStatusLabel(open.status)}</p>
              </div>
            </div>
            {open.note && <p className="text-sm text-text-2">“{open.note}”</p>}
            <p className="text-sm text-text-2">On this day all your codes stop, your staff and household members are removed, and everyone in your home is signed out.</p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            {isMain && <Button variant="outline" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Cancel moving out"}</Button>}
          </div>
        ) : open === null && isMain === false ? (
          <p className="rounded-2xl bg-mint-lightest p-4 text-deep">Only the main resident of your home can tell the estate you are moving out.</p>
        ) : open === null && isMain ? (
          <>
            <div className="rounded-[22px] bg-mint-lightest p-4 text-deep">
              <Truck className="size-8" />
              <p className="mt-2 font-semibold">What happens on your moving day</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                <li>All access codes for your home stop working.</li>
                <li>Your staff and household members are removed.</li>
                <li>Everyone in your home is signed out of the app.</li>
                <li>Your personal details are deleted after 90 days.</li>
              </ul>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">Moving day</span>
              <input type="date" value={date} min={lagosDateInput()} onChange={(e) => setDate(e.target.value)} className="h-13 min-h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            </label>
            <Field label="Note for the Estate Manager (optional)" placeholder="e.g. Movers arrive at 9am" value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button disabled={busy || !!loadError} onClick={request}>{busy ? "Sending…" : "Tell the Estate Manager"}</Button>
            <p className="text-center text-xs text-muted-foreground">Nothing changes until the Estate Manager confirms. You can cancel before the day.</p>
          </>
        ) : null}
      </Sheet>
      <ResidentTabs />
    </Screen>
  );
}

export default Moving;
