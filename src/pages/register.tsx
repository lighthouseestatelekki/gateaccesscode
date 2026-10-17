import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button, Field, Hero, Keypad, PinBoxes, Screen, SelectField, Sheet, usePin } from "@/components/lh/ui";
import { UNITS } from "@/mock/data";

export const title = "Register";

function Register() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const pin = usePin();
  const confirmation = usePin();
  const mismatch = pin.value.length === 6 && confirmation.value.length === 6 && pin.value !== confirmation.value;
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
          <Field label="Full name" autoComplete="name" />
          <Field label="Phone" type="tel" inputMode="tel" />
          <Field label="Email" type="email" inputMode="email" />
          <Field label="House number" inputMode="numeric" />
          <SelectField label="Unit" options={UNITS} />
        </section>
        <section hidden={step !== 2} className="space-y-4">
          <h2 className="text-lg font-semibold">Next of kin</h2>
          <Field label="Name" />
          <Field label="Phone" type="tel" inputMode="tel" />
          <Field label="Relationship" />
        </section>
        <section hidden={step !== 3} className="space-y-6">
          <h2 className="text-lg font-semibold">Choose your PIN</h2>
          <div role="group" aria-label="Enter 6 digits" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-text-2">Enter 6 digits</p>
              <p className="mt-1 text-sm text-muted-foreground">6 digits. Avoid easy ones like 123456 or 111111.</p>
            </div>
            <PinBoxes value={pin.value} />
            <Keypad onDigit={pin.onDigit} onBack={pin.onBack} />
          </div>
          <div role="group" aria-label="Confirm your PIN" className="space-y-4">
            <p className="text-sm font-medium text-text-2">Confirm your PIN</p>
            <PinBoxes value={confirmation.value} />
            <Keypad onDigit={confirmation.onDigit} onBack={confirmation.onBack} />
          </div>
          {mismatch && <p role="alert" className="text-sm font-medium text-destructive">PINs do not match.</p>}
        </section>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => step === 1 ? nav("/login") : setStep(step - 1)}>Back</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Continue</Button>
          ) : (
            <Button disabled={pin.value.length !== 6 || confirmation.value.length !== 6 || mismatch} onClick={() => nav("/pending")}>Submit registration</Button>
          )}
        </div>
      </Sheet>
    </Screen>
  );
}

export default Register;
