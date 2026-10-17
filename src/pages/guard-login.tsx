import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, Keypad, PinBoxes, usePin, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";

export const title = "Guard sign in";

function GuardLogin() {
  const nav = useNavigate();
  const pin = usePin();
  const [guardNumber, setGuardNumber] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!supabase.auth?.getSession) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,status,full_name,guard_number,assigned_gate")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (!profileError && profile && profile.role === "guard" && profile.status === "active") {
        nav("/guard/verify", { replace: true });
      }
    }
    checkSession();
    return () => {
      active = false;
    };
  }, [nav]);

  async function handleSignIn() {
    const cleanedNumber = guardNumber.replace(/^0+/, "");
    if (!cleanedNumber || pin.value.length !== 6) {
      setError("Enter your guard number and 6-digit PIN.");
      return;
    }

    setError("");
    setSigningIn(true);

    const email = `guard${cleanedNumber}@guards.lighthouseestate.app`;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pin.value,
    });

    if (signInError) {
      if (/invalid login credentials/i.test(signInError.message)) {
        setError("Guard number or PIN is incorrect.");
        pin.reset();
      } else {
        setError(signInError.message);
      }
      setSigningIn(false);
      return;
    }

    const user = signInData?.user;
    if (!user) {
      await supabase.auth.signOut();
      setError("This account is not an active guard. Please contact the Estate Manager.");
      setSigningIn(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status,full_name,guard_number,assigned_gate")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "guard" || profile.status !== "active") {
      await supabase.auth.signOut();
      setError("This account is not an active guard. Please contact the Estate Manager.");
      setSigningIn(false);
      return;
    }

    nav("/guard/verify");
  }

  return (
    <div className="hero mx-auto flex min-h-dvh max-w-md flex-col px-5 safe-bottom">
      <Wordmark />
      <h1 className="mt-10 text-3xl leading-tight">Assalam Alaekum, guard sign in</h1>
      <div className="mt-8 space-y-5">
        <Field
          tone="dark"
          label="Guard number"
          inputMode="numeric"
          placeholder="e.g. 7"
          value={guardNumber}
          onChange={(e) => {
            setError("");
            setGuardNumber(e.target.value.replace(/\D/g, ""));
          }}
        />
        <div className="space-y-3">
          <p className="text-sm font-medium text-deep-foreground/70">PIN</p>
          <PinBoxes value={pin.value} tone="dark" />
        </div>
      </div>
      <div className="mt-auto space-y-4 pt-8">
        <Keypad
          onDigit={(d) => {
            setError("");
            pin.onDigit(d);
          }}
          onBack={() => {
            setError("");
            pin.onBack();
          }}
          tone="dark"
        />
        {error && <p role="alert" className="text-center text-sm font-medium text-red-300">{error}</p>}
        <Button disabled={signingIn} onClick={handleSignIn}>
          {signingIn ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </div>
  );
}

export default GuardLogin;
