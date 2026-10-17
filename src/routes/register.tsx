import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button, Field, Hero, meta, PinEntry, Screen, SelectField, Sheet } from "@/components/lh/ui";
import { UNITS } from "@/mock/data";

export const Route = createFileRoute("/register")({
  head: () => meta("Register", "Register as a resident of Lighthouse Estate Lekki."),
  component: Register,
});

function Register() {
  const nav = useNavigate();
  return (
    <Screen>
      <Hero>
        <Link to="/login" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Register</h1>
        <p className="mt-1 text-deep-foreground/70">Your details are checked by the Estate Manager.</p>
      </Hero>
      <Sheet className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your details</h2>
          <Field label="Full name" autoComplete="name" />
          <Field label="Phone" type="tel" inputMode="tel" />
          <Field label="Email" type="email" />
          <Field label="House number" inputMode="numeric" />
          <SelectField label="Unit" options={UNITS} />
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Next of kin</h2>
          <Field label="Name" />
          <Field label="Phone" type="tel" inputMode="tel" />
          <Field label="Relationship" />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Choose a PIN</h2>
          <PinEntry label="Enter 6 digits" hint="6 digits. Avoid easy ones like 123456 or 111111." />
        </section>
        <Button onClick={() => nav({ to: "/pending" })}>Submit registration</Button>
      </Sheet>
    </Screen>
  );
}
