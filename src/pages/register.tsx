import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button, Field, Hero, Keypad, PinBoxes, Screen, SelectField, Sheet, usePin } from "@/components/lh/ui";
import { isWeakPin } from "@/lib/pin";
import { supabase } from "@/lib/supabase";
import { unitToCode } from "@/lib/units";
import { UNITS } from "@/mock/data";

export const title = "Register";

function Register() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [unit, setUnit] = useState<string>(UNITS[0]);

  const [nokName, setNokName] = useState("");
  const [nokPhone, setNokPhone] = useState("");
  const [nokRelationship, setNokRelationship] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pin = usePin();
  const confirmation = usePin();

  const weak = pin.value.length === 6 && isWeakPin(pin.value);
  const mismatch = pin.value.length === 6 && confirmation.value.length === 6 && pin.value !== confirmation.value;

  const step3Alert = error || (weak ? "That PIN is too easy to guess. Please choose another." : mismatch ? "PINs do not match." : "");
  const alertMessage = step === 3 ? step3Alert : error;

  function handleContinue() {
    if (step === 1) {
      const trimmedName = fullName.trim();
      const phoneDigits = phone.replace(/\D/g, "");
      const trimmedHouse = houseNumber.trim();
      const houseNum = Number(trimmedHouse);
      const valid =
        trimmedName.length >= 2 &&
        phoneDigits.length >= 10 &&
        email.includes("@") &&
        email.includes(".") &&
        /^\d+$/.test(trimmedHouse) &&
        houseNum >= 1 &&
        houseNum <= 999;

      if (!valid) {
        setError("Please check your details.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }

    if (step === 2) {
      const valid = nokName.trim().length > 0 && nokPhone.trim().length > 0 && nokRelationship.trim().length > 0;
      if (!valid) {
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

    const cleanedHouse = String(Number(houseNumber.trim()));
    const unitCode = unitToCode(unit);
    const loginEmail = `house${cleanedHouse}-${unitCode}@residents.lighthouseestate.app`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: loginEmail,
      password: pin.value,
    });

    if (signUpError) {
      if (signUpError.code === "user_already_exists" || /already registered/i.test(signUpError.message)) {
        setError("This house and unit is already registered. If this is you, log in. If not, please contact the Estate Manager.");
      } else {
        setError(signUpError.message);
      }
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: signUpData.user!.id,
      role: "resident",
      status: "pending",
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      house_number: cleanedHouse,
      house_unit: unitCode,
      nok_name: nokName.trim(),
      nok_phone: nokPhone.trim(),
      nok_relationship: nokRelationship.trim(),
    });

    if (insertError) {
      setError(`${insertError.message} Please contact the Estate Manager.`);
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    nav("/pending");
  }

  return (
    <Screen>
      <Hero>
        <Link to="/login" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Register</h1>
        <p className="mt-1 text-deep-foreground/70">Your details are checked by the Estate Manager.</p>
      </Hero>
      <Sheet className="space-y-8">
        <div aria-label="Registration progress" className="space-y-3">
          <p aria-live="polite" className="text-sm font-semibold text-text-2">Step {step} of 3</p>
          <div className="flex gap-2" aria-hidden="true">
            {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />)}
          </div>
        </div>
        <section hidden={step !== 1} className="space-y-4">
          <h2 className="text-lg font-semibold">Your details</h2>
          <Field label="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Field label="Phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field label="Email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="House number" inputMode="numeric" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
          <SelectField label="Unit" options={UNITS} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </section>
        <section hidden={step !== 2} className="space-y-4">
          <h2 className="text-lg font-semibold">Next of kin</h2>
          <Field label="Name" value={nokName} onChange={(e) => setNokName(e.target.value)} />
          <Field label="Phone" type="tel" inputMode="tel" value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} />
          <Field label="Relationship" value={nokRelationship} onChange={(e) => setNokRelationship(e.target.value)} />
        </section>
        <section hidden={step !== 3} className="space-y-6">
          <h2 className="text-lg font-semibold">Choose your PIN</h2>
          <div role="group" aria-label="Enter 6 digits" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-text-2">Enter 6 digits</p>
              <p className="mt-1 text-sm text-muted-foreground">6 digits. Avoid easy ones like 123456 or 111111.</p>
            </div>
            <PinBoxes value={pin.value} />
            <Keypad onDigit={(d) => { setError(""); pin.onDigit(d); }} onBack={() => { setError(""); pin.onBack(); }} />
          </div>
          <div role="group" aria-label="Confirm your PIN" className="space-y-4">
            <p className="text-sm font-medium text-text-2">Confirm your PIN</p>
            <PinBoxes value={confirmation.value} />
            <Keypad onDigit={(d) => { setError(""); confirmation.onDigit(d); }} onBack={() => { setError(""); confirmation.onBack(); }} />
          </div>
        </section>
        {alertMessage && <p role="alert" className="text-sm font-medium text-destructive">{alertMessage}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setError(""); if (step === 1) nav("/login"); else setStep(step - 1); }}>Back</Button>
          {step < 3 ? (
            <Button onClick={handleContinue}>Continue</Button>
          ) : (
            <Button
              disabled={submitting || pin.value.length !== 6 || confirmation.value.length !== 6 || mismatch || weak}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit registration"}
            </Button>
          )}
        </div>
      </Sheet>
    </Screen>
  );
}

export default Register;
