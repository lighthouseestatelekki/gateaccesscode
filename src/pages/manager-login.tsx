import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";
import { Button, Field, Hero, Keypad, PinBoxes, Screen, Sheet, usePin, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { setStaffChoice } from "@/lib/entry";
import { ResidentLink, StaffSwitch } from "@/components/lh/nav";
import { finishSetup, mfaState, startSetup, verifyCode } from "@/lib/mfa";

export const title = "Estate Manager sign in";

async function isActiveManager(userId: string) {
  const { data } = await supabase.from("profiles").select("role,status").eq("id", userId).single();
  return !!data && data.role === "estate_manager" && data.status === "active";
}

type Step = "password" | "code" | "setup";

function ManagerLogin() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);

  const done = () => {
    setStaffChoice("manager");
    nav("/manager/approvals", { replace: true });
  };

  // After the password: either straight in, ask for the code, or set the authenticator up first.
  async function next() {
    const s = await mfaState();
    if (s === "verified") return done();
    if (s === "needs_code") return setStep("code");
    setStep("setup");
    try {
      setSetup(await startSetup());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const code = usePin(async (v) => {
    setBusy(true);
    setError("");
    try {
      if (step === "setup") {
        if (!setup) throw new Error("Please wait for the set-up to load.");
        await finishSetup(setup.factorId, v);
      } else {
        await verifyCode(v);
      }
      done();
    } catch (e) {
      setError((e as Error).message);
      code.reset();
      setBusy(false);
    }
  });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (user && alive && (await isActiveManager(user.id))) await next();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setBusy(false);
    await next();
  }

  async function cancel() {
    await supabase.auth.signOut();
    setStep("password");
    setSetup(null);
    setError("");
    code.reset();
  }

  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <div className="mt-5"><StaffSwitch value="manager" /></div>
        <h1 className="mt-6 text-3xl font-semibold leading-tight">
          {step === "password" ? "Assalam Alaekum, Estate Manager sign in" : step === "code" ? "Enter your authenticator code" : "Protect this account"}
        </h1>
        {step !== "password" && (
          <p className="mt-2 text-deep-foreground/80">
            {step === "code" ? "Open your authenticator app and type the 6-digit code for Light House Estate." : "One-time set-up: link an authenticator app, so a stolen password alone can never open this account."}
          </p>
        )}
      </Hero>
      <Sheet className="space-y-5">
        {step === "password" && (
          <>
            <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in"}</Button>
            <div className="flex justify-center"><ResidentLink className="text-xs" /></div>
          </>
        )}

        {step === "setup" && (
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">1</span>
              <p className="pt-1 text-[15px]">Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone (free).</p>
            </li>
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">2</span>
              <div className="min-w-0 flex-1 pt-1 text-[15px]">
                <p>In the app, tap <b>+</b> and scan this code. On this same phone? Choose "Enter a setup key" and type the key below.</p>
                {setup ? (
                  <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl bg-white p-3">
                    <img src={setup.qr} alt="QR code for your authenticator app" className="size-44" />
                    <p className="code-digits break-all text-center text-sm font-bold text-deep-dark" data-no-translate>{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Preparing…</p>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">3</span>
              <p className="pt-1 text-[15px]">Type the 6-digit code the app shows.</p>
            </li>
          </ol>
        )}

        {step !== "password" && (
          <>
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-text-2">
              {step === "code" ? <Smartphone className="size-4" /> : <ShieldCheck className="size-4" />}
              {busy ? "Checking…" : "6-digit code"}
            </div>
            <PinBoxes value={code.value} />
            {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
            <Keypad onDigit={(d) => { if (!busy) { setError(""); code.onDigit(d); } }} onBack={code.onBack} />
            <p className="text-center text-xs text-muted-foreground">Lost your phone? The app administrator can remove the old authenticator in Supabase so you can set up a new one.</p>
            <Button variant="outline" onClick={cancel}>Cancel and sign out</Button>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

export default ManagerLogin;
