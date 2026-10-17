import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Field, Hero, meta, Screen, Sheet, Wordmark } from "@/components/lh/ui";

export const Route = createFileRoute("/manager/login")({
  head: () => meta("Estate Manager sign in", "Estate Manager sign in for Lighthouse Lekki."),
  component: ManagerLogin,
});

function ManagerLogin() {
  const nav = useNavigate();
  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold leading-tight">Assalam Alaekum, Estate Manager sign in</h1>
      </Hero>
      <Sheet className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" />
        <Field label="Password" type="password" autoComplete="current-password" />
        <Button onClick={() => nav({ to: "/manager/approvals" })}>Sign in</Button>
      </Sheet>
    </Screen>
  );
}
