import { useNavigate } from "react-router-dom";
import { Button, Field, Keypad, PinBoxes, usePin, Wordmark } from "@/components/lh/ui";

export const title = "Guard sign in";

function GuardLogin() {
  const nav = useNavigate();
  const pin = usePin();
  return (
    <div className="hero mx-auto flex min-h-dvh max-w-md flex-col px-5 safe-bottom">
      <Wordmark />
      <h1 className="mt-10 text-3xl leading-tight">Assalam Alaekum, guard sign in</h1>
      <div className="mt-8 space-y-5">
        <Field tone="dark" label="Guard number" inputMode="numeric" placeholder="e.g. 7" />
        <div className="space-y-3">
          <p className="text-sm font-medium text-deep-foreground/70">PIN</p>
          <PinBoxes value={pin.value} tone="dark" />
        </div>
      </div>
      <div className="mt-auto space-y-4 pt-8">
        <Keypad onDigit={pin.onDigit} onBack={pin.onBack} tone="dark" />
        <Button onClick={() => nav("/guard/verify")}>Sign in</Button>
      </div>
    </div>
  );
}

export default GuardLogin;
