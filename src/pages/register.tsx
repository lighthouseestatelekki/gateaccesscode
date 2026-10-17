import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Hero, Keypad, PinBoxes, Screen, Sheet, usePin } from "@/components/lh/ui";
import { isWeakPin } from "@/lib/pin";
import { pinAuth } from "@/lib/staffAdmin";
import { codeToUnit, UNIT_LABELS, unitToCode } from "@/lib/units";
import { cn } from "@/lib/utils";

export const title = "Register";

const DRAFT = "lh.reg";
const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Other"] as const;

type Draft = { fullName: string; phone: string; email: string; houseNumber: string; unit: string; nokName: string; nokPhone: string; nokRelationship: string };

function loadDraft(): Partial<Draft> {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) ?? "{}") as Partial<Draft>;
    // A house typed on the sign-in screen is the best guess for this one.
    const h = JSON.parse(localStorage.getItem("lh.house") ?? "null") as { number?: string; unit?: string } | null;
    if (h && !d.houseNumber) return { ...d, houseNumber: h.number ?? "", unit: h.unit ? codeToUnit(unitToCode(h.unit)) : (d.unit ?? UNIT_LABELS[0]) };
    return d;
  } catch {
    return {};
  }
}

/** Chips for picking one of a few options: faster than a dropdown, and a default is already chosen. */
function Chips({ label, options, value, onChange, cols = 2 }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-text-2">{label}</p>
      <div role="radiogroup" aria-label={label} className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn("flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] px-2 text-sm font-semibold transition-colors", value === o ? "border-primary bg-mint-light text-deep" : "border-border bg-card text-text-2")}
          >
            {value === o && <Check className="size-4" />}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Register() {
  const nav = useNavigate();
  const d0 = useState(loadDraft)[0];
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState(d0.fullName ?? "");
  const [phone, setPhone] = useState(d0.phone ?? "");
  const [email, setEmail] = useState(d0.email ?? "");
  const [houseNumber, setHouseNumber] = useState(d0.houseNumber ?? "");
  const [unit, setUnit] = useState<string>(d0.unit && (UNIT_LABELS as readonly string[]).includes(d0.unit) ? d0.unit : UNIT_LABELS[0]);

  const [nokName, setNokName] = useState(d0.nokName ?? "");
  const [nokPhone, setNokPhone] = useState(d0.nokPhone ?? "");
  const [nokRelationship, setNokRelationship] = useState(d0.nokRelationship ?? "Spouse");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [pinStage, setPinStage] = useState<0 | 1>(0);
  const pin = usePin(() => setPinStage(1));
  const confirmation = usePin();

  // Keep what they typed, so leaving and coming back loses nothing (the PIN is never saved).
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ fullName, phone, email, houseNumber, unit, nokName, nokPhone, nokRelationship }));
    } catch {
      /* storage blocked */
    }
  }, [fullName, phone, email, houseNumber, unit, nokName, nokPhone, nokRelationship]);

  const weak = pin.value.length === 6 && isWeakPin(pin.value);
  const mismatch = pin.value.length === 6 && confirmation.value.length === 6 && pin.value !== confirmation.value;
  const step3Alert = error || (weak ? "That PIN is too easy to guess. Please choose another." : mismatch ? "PINs do not match." : "");
  const alertMessage = step === 3 ? step3Alert : error;

  // Progress starts at 20%: opening the app was the first step.
  const checks = [
    fullName.trim().length >= 2, phone.replace(/\D/g, "").length >= 10, /\S+@\S+\.\S+/.test(email), /^\d{1,3}$/.test(houseNumber.trim()) && Number(houseNumber) > 0,
    nokName.trim().length > 0, nokPhone.replace(/\D/g, "").length >= 10, pin.value.length === 6 && !weak, confirmation.value.length === 6 && !mismatch,
  ];
  const pct = Math.round(20 + (75 * checks.filter(Boolean).length) / checks.length);
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const house = String(Number(houseNumber.trim()) || "");

  function handleContinue() {
    if (step === 1) {
      if (!checks.slice(0, 4).every(Boolean)) {
        setError("Please check your details.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!nokName.trim() || !nokPhone.trim() || !nokRelationship.trim()) {
        setError("Please fill in your next of kin.");
        return;
      }
      setError("");
      setStep(3);
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      await pinAuth({
        action: "register",
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        house_number: String(Number(houseNumber.trim())),
        house_unit: unitToCode(unit),
        nok_name: nokName.trim(),
        nok_phone: nokPhone.trim(),
        nok_relationship: nokRelationship.trim(),
        pin: pin.value,
      });
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      return;
    }
    try {
      localStorage.removeItem(DRAFT);
    } catch {
      /* ignore */
    }
    nav("/pending");
  }

  const stepNames = ["You and your house", "Next of kin", "Your PIN"];

  return (
    <Screen>
      <Hero className="pb-12">
        <div className="flex items-center justify-between">
          <Link to="/login" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
          <span className="text-sm font-semibold text-deep-foreground/75">About 1 minute</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Register</h1>

        {/* The pass they are building: fills in as they type. */}
        <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-white/10 p-3.5 ring-1 ring-white/15">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold font-display text-xl font-extrabold text-deep-dark">{firstName[0]?.toUpperCase() ?? "?"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.14em] text-gold">Your house pass</p>
              <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-deep-foreground/85">Not active yet</span>
            </div>
            <p className="truncate font-display text-xl font-bold leading-tight">{firstName || "Your name"}</p>
            <p className="truncate text-sm text-deep-foreground/75">{house ? `House ${house}` : "House —"} · {unit}</p>
          </div>
        </div>

        <div className="mt-4" aria-label="Registration progress">
          <div className="flex items-baseline justify-between text-sm">
            <p aria-live="polite" className="font-semibold">Step {step} of 3 · {stepNames[step - 1]}</p>
            <p className="font-bold text-gold">{pct}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25" aria-hidden="true">
            <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Hero>

      <Sheet className="space-y-5">
        <section hidden={step !== 1} className="space-y-4">
          <Field label="Full name" autoComplete="name" placeholder="e.g. Aisha Bello" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@…" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] items-start gap-3">
            <Field label="House no." inputMode="numeric" placeholder="14" maxLength={3} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value.replace(/\D/g, ""))} />
            <Chips label="Unit" options={UNIT_LABELS} value={unit} onChange={setUnit} />
          </div>
        </section>

        <section hidden={step !== 2} className="space-y-4">
          <p className="text-sm text-text-2">Who should the estate call in an emergency?</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" placeholder="Full name" value={nokName} onChange={(e) => setNokName(e.target.value)} />
            <Field label="Phone" type="tel" inputMode="tel" placeholder="0803…" value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} />
          </div>
          <Chips label="Relationship" options={RELATIONS} value={nokRelationship} onChange={setNokRelationship} cols={3} />
        </section>

        <section hidden={step !== 3} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([["Enter 6 digits", pin, 0], ["Confirm your PIN", confirmation, 1]] as const).map(([label, p, i]) => (
              <button
                key={label}
                type="button"
                onClick={() => setPinStage(i)}
                className={cn("rounded-2xl border-[1.5px] px-3 py-3 text-left", pinStage === i ? "border-primary bg-mint-lightest" : "border-border bg-card")}
              >
                <span className="mb-2 block text-sm font-semibold text-text-2">{label}</span>
                <PinBoxes value={p.value} />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">6 digits. Avoid easy ones like 123456 or 111111.</p>
          <div role="group" aria-label={pinStage === 0 ? "Enter 6 digits" : "Confirm your PIN"}>
            <Keypad
              onDigit={(d) => { setError(""); (pinStage === 0 ? pin : confirmation).onDigit(d); }}
              onBack={() => { setError(""); (pinStage === 0 ? pin : confirmation).onBack(); }}
            />
          </div>
          <p className="rounded-2xl bg-gold-light px-4 py-2.5 text-sm font-medium text-gold-text">Last step. Until you finish, your house pass stays inactive and visitors keep waiting at the gate.</p>
        </section>

        {alertMessage && <p role="alert" className="text-sm font-medium text-destructive">{alertMessage}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="w-auto px-6" onClick={() => { setError(""); if (step === 1) nav("/login"); else setStep(step - 1); }}>Back</Button>
          {step < 3 ? (
            <Button onClick={handleContinue}>Continue</Button>
          ) : (
            <Button disabled={submitting || pin.value.length !== 6 || confirmation.value.length !== 6 || mismatch || weak} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit registration"}
            </Button>
          )}
        </div>
        <p hidden={step === 3} className="text-center text-xs text-muted-foreground">Your details are saved on this phone until you finish. The Estate Manager checks them before approving.</p>
      </Sheet>
    </Screen>
  );
}

export default Register;
