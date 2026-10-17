import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Field, Hero, Keypad, meta, PinBoxes, Screen, Sheet, usePin, Wordmark } from "@/components/lh/ui";

export const Route = createFileRoute("/guard/login")({
  head: () => meta("Guard sign in", "Gate guards sign in to check visitor codes."),
  component: GuardLogin,
});

function GuardLogin() {
  const nav = useNavigate();
  const pin = usePin();
  return (
    <Screen>
      <Hero>
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold leading-tight">Assalam Alaekum, guard sign in</h1>
      </Hero>
      <Sheet className="space-y-5">
        <Field label="Guard number" inputMode="numeric" placeholder="e.g. 7" />
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-2">PIN</p>
          <PinBoxes value={pin.value} />
        </div>
        <Keypad onDigit={pin.onDigit} onBack={pin.onBack} />
        <Button onClick={() => nav({ to: "/guard/verify" })}>Sign in</Button>
      </Sheet>
    </Screen>
  );
}
