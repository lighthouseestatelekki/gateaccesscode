import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Fingerprint, ShieldCheck, Smartphone } from "lucide-react";
import { Button, Field, Hero, Keypad, PinBoxes, Screen, Sheet, usePin, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { setStaffChoice } from "@/lib/entry";
import { ResidentLink, StaffSwitch } from "@/components/lh/nav";
import { finishSetup, hasFingerprint, mfaState, startSetup, verifyCode } from "@/lib/mfa";
import { confirmWithPasskey, passkeySupported, registerPasskey, signInWithPasskey } from "@/lib/passkey";

export const title = "Estate Manager sign in";

async function managerRow(userId: string) {
  const { data } = await supabase.from("profiles").select("role,status,must_change_pin").eq("id", userId).single();
  return data && data.role === "estate_manager" && data.status === "active" ? data : null;
}

type Step = "password" | "newpass" | "code" | "fingerprint" | "setup";

const HEAD: Record<Step, [string, string]> = {
  password: ["Assalam Alaekum, Estate Manager sign in", ""],
  newpass: ["Choose your own password", "You signed in with a temporary password. Choose a new one that only you know."],
  code: ["Enter your authenticator code", "Open your authenticator app and type the 6-digit code for Light House Estate."],
  fingerprint: ["Confirm it's you", "Use your fingerprint or face to finish signing in."],
  setup: ["Protect this account", "One-time set-up: add a second step, so a stolen password alone can never open this account."],
};

function ManagerLogin() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canFinger, setCanFinger] = useState(false); // this phone can do fingerprint sign-in
  const [hasFinger, setHasFinger] = useState(false); // this account has a fingerprint set up somewhere
  const [useApp, setUseApp] = useState(false); // chose the authenticator app during set-up
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const uid = useRef("");

  const done = () => {
    setStaffChoice("manager");
    nav("/manager/approvals", { replace: true });
  };

  async function beginAppSetup() {
    setUseApp(true);
    try {
      setSetup(await startSetup());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // After the password: new password first (if temporary), then straight in, or the second step.
  async function next(userId: string, mustChange: boolean) {
    uid.current = userId;
    if (mustChange) return setStep("newpass");
    const s = await mfaState(userId);
    if (s === "verified") return done();
    setHasFinger(await hasFingerprint(userId));
    if (s === "needs_code") return setStep("code");
    if (s === "needs_fingerprint") return setStep("fingerprint");
    setStep("setup");
    if (!(await passkeySupported())) await beginAppSetup();
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
    passkeySupported().then((ok) => alive && setCanFinger(ok));
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (!user || !alive) return;
      const row = await managerRow(user.id);
      if (row && alive) await next(user.id, !!row.must_change_pin);
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
    const row = await managerRow(data.user.id);
    if (!row) {
      await supabase.auth.signOut();
      setError("This account is not an active Estate Manager account.");
      setBusy(false);
      return;
    }
    setBusy(false);
    await next(data.user.id, !!row.must_change_pin);
  }

  async function fingerprintSignIn() {
    setError("");
    setBusy(true);
    try {
      const role = await signInWithPasskey();
      if (role !== "estate_manager") {
        await supabase.auth.signOut();
        throw new Error("This fingerprint belongs to a resident account. Residents sign in on the resident screen.");
      }
      const { data } = await supabase.auth.getSession();
      const id = data?.session?.user?.id ?? "";
      const row = id ? await managerRow(id) : null;
      if (!row) throw new Error("This account is not an active Estate Manager account.");
      setBusy(false);
      await next(id, !!row.must_change_pin);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function savePassword() {
    if (pw1.length < 10) return setError("Use at least 10 characters.");
    if (pw1 !== pw2) return setError("The two passwords are not the same.");
    if (pw1 === password) return setError("Choose a password different from the temporary one.");
    setError("");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw1 });
    if (err) {
      setError(/weak|short|pwned|leaked/i.test(err.message) ? "That password is too easy to guess. Please choose a stronger one." : err.message);
      setBusy(false);
      return;
    }
    await supabase.rpc("clear_must_change_pin");
    setPw1("");
    setPw2("");
    setBusy(false);
    await next(uid.current, false);
  }

  async function confirmFinger() {
    setError("");
    setBusy(true);
    try {
      await confirmWithPasskey();
      done();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function addFinger() {
    setError("");
    setBusy(true);
    try {
      await registerPasskey();
      done();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function cancel() {
    await supabase.auth.signOut();
    setStep("password");
    setSetup(null);
    setUseApp(false);
    setError("");
    code.reset();
  }

  const showKeypad = step === "code" || (step === "setup" && useApp);
  const [head, sub] = HEAD[step];

  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <div className="mt-5"><StaffSwitch value="manager" /></div>
        <h1 className="mt-6 text-3xl font-semibold leading-tight">{head}</h1>
        {sub && <p className="mt-2 text-deep-foreground/80">{sub}</p>}
      </Hero>
      <Sheet className="space-y-5">
        {step === "password" && (
          <>
            {canFinger && (
              <>
                <Button disabled={busy} onClick={fingerprintSignIn}>
                  <Fingerprint className="size-5" /> Sign in with fingerprint
                </Button>
                <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">or use your password</p>
              </>
            )}
            <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button variant={canFinger ? "outline" : "primary"} disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in with password"}</Button>
            <div className="flex justify-center"><ResidentLink className="text-xs" /></div>
          </>
        )}

        {step === "newpass" && (
          <>
            <Field label="New password (at least 10 characters)" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
            <Field label="Type it again" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && savePassword()} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button disabled={busy} onClick={savePassword}>{busy ? "Saving…" : "Save password"}</Button>
            <Button variant="outline" onClick={cancel}>Cancel and sign out</Button>
          </>
        )}

        {step === "fingerprint" && (
          <>
            <div className="flex justify-center py-2"><Fingerprint className="size-16 text-primary" aria-hidden /></div>
            {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
            <Button disabled={busy} onClick={confirmFinger}>{busy ? "Checking…" : "Confirm with fingerprint"}</Button>
            <p className="text-center text-xs text-muted-foreground">Use a phone where you turned on fingerprint sign-in. Lost it? Ask another Estate Manager to reset your sign-in.</p>
            <Button variant="outline" onClick={cancel}>Cancel and sign out</Button>
          </>
        )}

        {step === "setup" && !useApp && (
          <>
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Fingerprint className="size-6" /></span>
                <div>
                  <p className="font-bold">Use your fingerprint (recommended)</p>
                  <p className="text-sm text-text-2">Quick and safe. Next time, sign in with just your fingerprint on this phone.</p>
                </div>
              </div>
              <Button className="mt-4" disabled={busy} onClick={addFinger}>{busy ? "Setting up…" : "Use fingerprint on this phone"}</Button>
            </div>
            {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
            <Button variant="outline" disabled={busy} onClick={beginAppSetup}><Smartphone className="size-5" /> Use an authenticator app instead</Button>
            <Button variant="ghost" onClick={cancel}>Cancel and sign out</Button>
          </>
        )}

        {step === "setup" && useApp && (
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

        {showKeypad && (
          <>
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-text-2">
              {step === "code" ? <Smartphone className="size-4" /> : <ShieldCheck className="size-4" />}
              {busy ? "Checking…" : "6-digit code"}
            </div>
            <PinBoxes value={code.value} />
            {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
            <Keypad onDigit={(d) => { if (!busy) { setError(""); code.onDigit(d); } }} onBack={code.onBack} />
            {step === "code" && hasFinger && canFinger && (
              <Button variant="secondary" disabled={busy} onClick={confirmFinger}><Fingerprint className="size-5" /> Use fingerprint instead</Button>
            )}
            <p className="text-center text-xs text-muted-foreground">Lost your phone? Ask another Estate Manager to reset your sign-in (More → Estate Managers).</p>
            <Button variant="outline" onClick={cancel}>Cancel and sign out</Button>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

export default ManagerLogin;
