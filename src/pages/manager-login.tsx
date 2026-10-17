import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button, Field, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { setStaffChoice } from "@/lib/entry";
import { ResidentLink, StaffSwitch } from "@/components/lh/nav";

export const title = "Estate Manager sign in";

async function isActiveManager(userId: string) {
  const { data } = await supabase.from("profiles").select("role,status").eq("id", userId).single();
  return !!data && data.role === "estate_manager" && data.status === "active";
}

function ManagerLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (user && alive && (await isActiveManager(user.id))) nav("/manager/approvals", { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [nav]);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setBusy(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err || !data.user) {
      setError(/invalid login credentials/i.test(err?.message ?? "") ? "Email or password is incorrect." : (err?.message ?? "Could not sign in."));
      setBusy(false);
      return;
    }
    if (!(await isActiveManager(data.user.id))) {
      await supabase.auth.signOut();
      setError("This account is not an Estate Manager account.");
      setBusy(false);
      return;
    }
    setStaffChoice("manager");
    nav("/manager/approvals", { replace: true });
  }

  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <div className="mt-5"><StaffSwitch value="manager" /></div>
        <h1 className="mt-6 text-3xl font-semibold leading-tight">Assalam Alaekum, Estate Manager sign in</h1>
      </Hero>
      <Sheet className="space-y-5">
        <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in"}</Button>
        <div className="flex justify-center"><ResidentLink className="text-xs" /></div>
      </Sheet>
    </Screen>
  );
}

export default ManagerLogin;
