import { useParams } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, Field, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { photoToJpeg } from "@/lib/photo";
import { ID_TYPES } from "@/lib/staffOnboarding";
import { codeToUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

export const title = "Staff registration";

type Info =
  | { status: "loading" }
  | { status: "not_found" | "expired" | "submitted" | "sent" }
  | { status: "open"; full_name: string; job_title: string; house: string; unit: string; note: string | null; phone: string | null };

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-bold", done ? "bg-primary text-primary-foreground" : "bg-mint-light text-deep")}>
          {done ? "✓" : n}
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** Opened by the staff member from the link the resident sent. No sign-in needed. */
function Join() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Info>({ status: "loading" });
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [last4, setLast4] = useState("");
  const [kinKind, setKinKind] = useState<"next_of_kin" | "guarantor">("next_of_kin");
  const [kinName, setKinName] = useState("");
  const [kinPhone, setKinPhone] = useState("");
  const [kinRelation, setKinRelation] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.rpc("staff_invite_info", { p_token: token }).then(({ data, error: err }) => {
      if (err || !data) return setInfo({ status: "not_found" });
      const d = data as Info;
      setInfo(d);
      if (d.status === "open") {
        setName(d.full_name);
        setPhone(d.phone ?? "");
      }
    });
  }, [token]);

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoBusy(true);
    setError("");
    try {
      setPhoto(await photoToJpeg(f));
    } catch (e) {
      setError((e as Error).message);
    }
    setPhotoBusy(false);
  }

  const digits = (s: string) => s.replace(/\D/g, "").length;
  const done = {
    photo: !!photo,
    you: name.trim().length >= 2 && digits(phone) >= 7,
    id: !!idType && /^[A-Za-z0-9]{4}$/.test(last4),
    kin: kinName.trim().length >= 2 && digits(kinPhone) >= 7,
  };
  const progress = 20 + Object.values(done).filter(Boolean).length * 20;

  async function submit() {
    if (!done.photo) return setError("Please take a photo of your face.");
    if (!done.you) return setError("Please enter your full name and phone number.");
    if (!done.id) return setError("Please choose your ID and enter its last 4 digits.");
    if (!done.kin) return setError("Please add your next of kin or guarantor's name and phone number.");
    if (!consent) return setError("Please tick the box to agree.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("staff_invite_submit", {
      p_token: token, p_full_name: name.trim(), p_phone: phone.trim(), p_id_type: idType, p_id_last4: last4.toUpperCase(),
      p_kin_kind: kinKind, p_kin_name: kinName.trim(), p_kin_phone: kinPhone.trim(), p_kin_relation: kinRelation.trim(),
      p_photo: photo, p_consent: consent,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setInfo({ status: "sent" });
    window.scrollTo({ top: 0 });
  }

  if (info.status === "loading") return <Screen><Hero><Wordmark /></Hero><Sheet><p className="py-10 text-center text-text-2">Loading…</p></Sheet></Screen>;

  if (info.status !== "open") {
    const msg = {
      not_found: ["This link is not valid", "It may have been replaced by a newer link. Please ask the house for a new one.", Clock],
      expired: ["This link has expired", "Links work for 7 days. Please ask the house to send you a new one.", Clock],
      submitted: ["Your details are with the house", "They will check and approve you. Your gate code works once they do.", ShieldCheck],
      sent: ["JazakAllahu Khairan. Details sent.", "The house will check and approve you. Your gate code works once they do. You can close this page.", CheckCircle2],
    }[info.status] as [string, string, typeof Clock];
    const [h, p, Icon] = msg;
    return (
      <Screen>
        <Hero className="pb-16"><Wordmark /></Hero>
        <Sheet className="space-y-4 text-center">
          <Icon className="mx-auto size-14 text-primary" />
          <h1 className="text-2xl font-semibold">{h}</h1>
          <p className="text-text-2">{p}</p>
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen>
      <Hero className="pb-14">
        <Wordmark />
        <h1 className="mt-6 text-3xl font-semibold leading-tight">Staff registration</h1>
        <p className="mt-1 text-deep-foreground/80">{info.job_title} for House {info.house} · {codeToUnit(info.unit)}. Takes about 2 minutes.</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-xs font-semibold text-deep-foreground/70">{progress}% done</p>
      </Hero>
      <Sheet className="space-y-4 pb-8">
        {info.note && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">The house asked you to fix: {info.note}</p>}

        <Step n={1} done={done.photo} title="Photo of your face">
          <p className="mb-3 text-sm text-text-2">The guard sees this photo at the gate. Face the camera, no cap or sunglasses.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {photo ? (
            <div className="flex items-center gap-4">
              <img src={photo} alt="Your photo" className="size-28 rounded-2xl object-cover" />
              <button onClick={() => fileRef.current?.click()} className="flex min-h-11 items-center gap-2 rounded-full bg-mint-light px-4 font-semibold text-deep"><RefreshCw className="size-4" /> Take again</button>
            </div>
          ) : (
            <Button variant="secondary" disabled={photoBusy} onClick={() => fileRef.current?.click()}><Camera className="size-5" /> {photoBusy ? "Preparing…" : "Take photo"}</Button>
          )}
        </Step>

        <Step n={2} done={done.you} title="About you">
          <div className="space-y-3">
            <Field label="Full name (as on your ID)" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Your phone number" type="tel" inputMode="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </Step>

        <Step n={3} done={done.id} title="Your ID">
          <div role="radiogroup" aria-label="ID type" className="grid grid-cols-2 gap-2">
            {ID_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={idType === t} onClick={() => setIdType(t)} className={cn("min-h-11 rounded-2xl border-[1.5px] px-2 text-sm font-semibold", idType === t ? "border-primary bg-mint-light text-deep" : "border-border bg-card text-text-2")}>{t}</button>
            ))}
          </div>
          <div className="mt-3">
            <Field label="Last 4 digits of the ID number" inputMode="text" maxLength={4} autoCapitalize="characters" placeholder="e.g. 4821" value={last4} onChange={(e) => setLast4(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))} />
            <p className="mt-1.5 text-xs text-muted-foreground">Only the last 4 are kept. Bring the card with you; the guard may ask to see it.</p>
          </div>
        </Step>

        <Step n={4} done={done.kin} title="Next of kin or guarantor">
          <div role="radiogroup" aria-label="Who" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {([["next_of_kin", "Next of kin"], ["guarantor", "Guarantor"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={kinKind === k} onClick={() => setKinKind(k)} className={cn("min-h-11 rounded-xl font-semibold", kinKind === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>{l}</button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Their full name" value={kinName} onChange={(e) => setKinName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Their phone" type="tel" inputMode="tel" value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} />
              <Field label={kinKind === "guarantor" ? "How you know them" : "Relationship"} placeholder={kinKind === "guarantor" ? "e.g. Former boss" : "e.g. Brother"} value={kinRelation} onChange={(e) => setKinRelation(e.target.value)} />
            </div>
          </div>
        </Step>

        <label className="flex items-start gap-3 rounded-2xl bg-mint-lightest p-4">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-[var(--primary)]" />
          <span className="text-sm text-deep">I agree that Light House Estate can keep these details to check me at the gate and for estate security. They are shared only with the house I work for and the Estate Manager, and are deleted when I stop working here.</span>
        </label>

        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send my details"}</Button>
      </Sheet>
    </Screen>
  );
}

export default Join;
