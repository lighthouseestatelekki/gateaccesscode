import { useNavigate } from "react-router-dom";
import { Button, Field, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";

export const title = "Estate Manager sign in";

function ManagerLogin() {
  const nav = useNavigate();
  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold leading-tight">Assalam Alaekum, Estate Manager sign in</h1>
      </Hero>
      <Sheet className="space-y-5">
        <Field label="Email" type="email" inputMode="email" autoComplete="email" />
        <Field label="Password" type="password" autoComplete="current-password" />
        <Button onClick={() => nav("/manager/approvals")}>Sign in</Button>
      </Sheet>
    </Screen>
  );
}

export default ManagerLogin;
