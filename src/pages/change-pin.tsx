import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button, Hero, Keypad, PinBoxes, Screen, Sheet, usePin, Wordmark } from "@/components/lh/ui";
import { isWeakPin } from "@/lib/pin";
import { pinAuth } from "@/lib/staffAdmin";
import { useResident } from "@/lib/useResident";

export const title = "Choose your new PIN";

function ChangePin() {
  const nav = useNavigate();
  const profile = useResident();
  const [step, setStep] = useState<0 | 1>(0);
  const first = usePin(() => setStep(1));
  const second = usePin();
  const cur = step === 0 ? first : second;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const weak = first.value.length === 6 && isWeakPin(first.value);
  const mismatch = first.value.length === 6 && second.value.length === 6 && first.value !== second.value;
  const message = error || (weak ? "That PIN is too easy to guess. Please choose another." : mismatch ? "PINs do not match." : "");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await pinAuth({ action: "change_pin", pin: first.value });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return;
    }
    nav("/home", { replace: true });
  }

  if (!profile) return null;

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
        {message && <p role="alert" className="text-center text-sm font-medium text-destructive">{message}</p>}
        <Keypad onDigit={(d) => { setError(""); cur.onDigit(d); }} onBack={() => { setError(""); cur.onBack(); }} />
        <Button disabled={busy || first.value.length !== 6 || second.value.length !== 6 || weak || mismatch} onClick={save}>
          {busy ? "Saving…" : "Save PIN"}
        </Button>
      </Sheet>
    </Screen>
  );
}

export default ChangePin;
