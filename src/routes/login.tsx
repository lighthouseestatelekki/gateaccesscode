import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Field, HadithLine, Hero, Keypad, meta, PinBoxes, Screen, SelectField, Sheet, usePin, Wordmark } from "@/components/lh/ui";
import { UNITS } from "@/mock/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => meta("Resident log in", "Log in with your house number and 6-digit PIN."),
  component: Login,
});

const ERRORS = ["House number or PIN is incorrect", "Your account is waiting for approval"];

function Login() {
  const nav = useNavigate();
  const pin = usePin();
  const [demo, setDemo] = useState(false);
  const [err, setErr] = useState<number | null>(null);
  return (
    <Screen>
      <Hero>
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold leading-tight">Assalam Alaekum, welcome back</h1>
      </Hero>
      <Sheet className="space-y-5">
        <Field label="House number" inputMode="numeric" placeholder="e.g. 14" />
        <SelectField label="Unit" options={UNITS} />
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-2">PIN</p>
          <PinBoxes value={pin.value} />
        </div>
        {err !== null && (
          <div className={cn("flex items-start gap-2 rounded-sm px-4 py-3 text-sm font-medium", err === 0 ? "bg-destructive-light text-destructive" : "bg-gold-light text-gold-text")}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {ERRORS[err]}
          </div>
        )}
        <Keypad onDigit={pin.onDigit} onBack={pin.onBack} />
        <Button onClick={() => nav({ to: "/home" })}>Log in</Button>
        <p className="text-center text-base">
          <Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-deep underline-offset-4 hover:underline">New here? Register</Link>
        </p>
        <div className="rounded-sm border border-dashed border-border p-2">
          <button onClick={() => setDemo(!demo)} className="min-h-9 w-full text-xs font-bold tracking-widest text-muted-foreground">DEMO</button>
          {demo && (
            <div className="flex gap-2 pt-1">
              {ERRORS.map((e, i) => (
                <button key={e} onClick={() => setErr(err === i ? null : i)} className="min-h-11 flex-1 rounded-sm bg-muted px-2 text-xs text-text-2">{i === 0 ? "Wrong PIN" : "Awaiting approval"}</button>
              ))}
            </div>
          )}
        </div>
        <HadithLine className="pt-2" />
      </Sheet>
    </Screen>
  );
}
