import { Link, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useGuard } from "@/lib/useGuard";
import { photoToJpeg } from "@/lib/photo";
import { INCIDENT_TYPES } from "@/lib/incidents";
import { UNIT_LABELS, unitToCode } from "@/lib/units";
import { cn } from "@/lib/utils";

export const title = "Report an incident";

const chip = (on: boolean) => cn("min-h-12 rounded-2xl border-[1.5px] px-3 text-sm font-semibold", on ? "border-gold bg-gold text-deep-dark" : "border-deep-foreground/20 bg-deep-mid text-deep-foreground");

/** Guard reports something that happened. The Estate Manager (and the house, if one is named) is told at once. */
function GuardIncident() {
  const nav = useNavigate();
  const profile = useGuard();
  const [cat, setCat] = useState("");
  const [desc, setDesc] = useState("");
  const [house, setHouse] = useState("");
  const [unit, setUnit] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setError("");
    try {
      setPhoto(await photoToJpeg(f, 1024, 560_000));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send() {
    if (!cat) return setError("Choose what happened.");
    if (desc.trim().length < 5) return setError("Say briefly what happened.");
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("report_incident", {
      p_category: cat, p_description: desc.trim(), p_house: house.trim() || null,
      p_unit: house.trim() && unit ? unitToCode(unit) : null, p_photo: photo || null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setSent((data as { ref: number }).ref);
  }

  if (!profile) return null;

  if (sent != null) {
    return (
      <div className="hero mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center safe-bottom">
        <CheckCircle2 className="size-20 text-gold" />
        <h1 className="text-3xl font-bold">Report #{sent} sent</h1>
        <p className="text-deep-foreground/80">The Estate Manager has been alerted{house.trim() ? `, and House ${house.trim()}` : ""}.</p>
        <Button variant="gold" onClick={() => nav("/guard/verify")}>Back to the gate</Button>
      </div>
    );
  }

  return (
    <div className="hero mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 safe-bottom">
      <Link to="/guard/verify" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
      <h1 className="mt-1 text-3xl font-bold">Report an incident</h1>
      <p className="mt-1 text-deep-foreground/70">The Estate Manager is alerted straight away.</p>

      <p className="mt-6 mb-2 text-sm font-semibold text-deep-foreground/80">What happened?</p>
      <div role="radiogroup" aria-label="What happened" className="grid grid-cols-2 gap-2">
        {INCIDENT_TYPES.map(([k, l]) => (
          <button key={k} role="radio" aria-checked={cat === k} onClick={() => setCat(k)} className={chip(cat === k)}>{l}</button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-semibold text-deep-foreground/80">Details</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 1000))} rows={4} placeholder="Who, what, where. e.g. Man in red shirt walking along the back fence at 2am." className="w-full rounded-2xl border-[1.5px] border-deep-foreground/20 bg-deep-mid p-3 text-base text-deep-foreground outline-none placeholder:text-deep-foreground/40 focus:border-gold" />
      </label>

      <p className="mt-5 mb-1.5 text-sm font-semibold text-deep-foreground/80">Which house? (optional)</p>
      <input inputMode="numeric" value={house} onChange={(e) => setHouse(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 6))} placeholder="House number" className="h-12 w-full rounded-2xl border-[1.5px] border-deep-foreground/20 bg-deep-mid px-4 text-base text-deep-foreground outline-none placeholder:text-deep-foreground/40 focus:border-gold" />
      {house.trim() && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {UNIT_LABELS.map((u) => (
            <button key={u} onClick={() => setUnit(unit === u ? "" : u)} className={chip(unit === u)}>{u}</button>
          ))}
          <p className="col-span-2 text-xs text-deep-foreground/60">{unit ? `Only ${unit} is told.` : "No unit picked: everyone at this house number is told."}</p>
        </div>
      )}

      <p className="mt-5 mb-1.5 text-sm font-semibold text-deep-foreground/80">Photo (optional)</p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      {photo ? (
        <div className="relative w-fit">
          <img src={photo} alt="Incident photo" className="h-36 rounded-2xl object-cover" />
          <button aria-label="Remove photo" onClick={() => setPhoto("")} className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-deep-dark"><X className="size-4" /></button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-deep-foreground/30 font-semibold"><Camera className="size-5" /> Take a photo</button>
      )}

      {error && <p role="alert" className="mt-4 font-semibold text-red-300">{error}</p>}
      <div className="mt-6"><Button variant="gold" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send report"}</Button></div>
    </div>
  );
}

export default GuardIncident;
