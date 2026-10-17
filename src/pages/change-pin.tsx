import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button, Hero, Keypad, PinBoxes, Screen, Sheet, usePin, Wordmark } from "@/components/lh/ui";

export const title = "Choose your new PIN";

function ChangePin() {
  const nav = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);
  const first = usePin(() => setStep(1));
  const second = usePin();
  const cur = step === 0 ? first : second;
  return (
    <Screen>
      <Hero>
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold">Choose your new PIN</h1>
      </Hero>
      <Sheet className="space-y-6">
        <div className="flex gap-2">
          {["Enter 6 digits", "Confirm 6 digits"].map((l, i) => (
            <button key={l} onClick={() => setStep(i as 0 | 1)} className={`min-h-11 flex-1 rounded-sm text-sm font-semibold ${step === i ? "bg-mint-light text-deep" : "bg-muted text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <PinBoxes value={cur.value} />
        <Keypad onDigit={cur.onDigit} onBack={cur.onBack} />
        <Button disabled={second.value.length < 6} onClick={() => nav("/home")}>Save PIN</Button>
      </Sheet>
    </Screen>
  );
}

export default ChangePin;
