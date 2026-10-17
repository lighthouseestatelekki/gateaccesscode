import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Keypad, PinDigits } from "@/components/lh/guard";
import { usePin } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useGuard } from "@/lib/useGuard";
import { useMe } from "@/lib/useMe";
import { AlertsCard } from "@/components/lh/AlertsCard";

export const title = "Check code";

type VerifyResult = {
  result: "access" | "expired" | "denied" | string;
  direction?: string;
  reason?: string;
  type?: string;
  house?: string | number;
  unit?: string;
  holder?: string;
};

function Verify() {
  const nav = useNavigate();
  const profile = useGuard();
  const me = useMe();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let sentinel: { release?: () => Promise<void> } | null = null;
    let active = true;

    async function acquireWakeLock() {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl?.request) {
          const s = await wl.request("screen");
          if (active) sentinel = s;
          else await s.release?.();
        }
      } catch {
        // Ignore if unsupported
      }
    }

    acquireWakeLock();
    return () => {
      active = false;
      try {
        sentinel?.release?.();
      } catch {
        // Ignore
      }
    };
  }, []);

  const pin = usePin(async (theSixDigits) => {
    setChecking(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("verify_code", {
      p_code: theSixDigits,
    });

    if (rpcError) {
      setError(rpcError.message);
      pin.reset();
      setChecking(false);
      return;
    }

    const res = (Array.isArray(data) ? data[0] : data) as VerifyResult;
    const verdict =
      res.result === "access"
        ? "/guard/verdict/access"
        : res.result === "expired"
          ? "/guard/verdict/expired"
          : "/guard/verdict/denied";

    nav(verdict, { state: res });
  });

  if (!profile) return null;

  const gateDisplay = String(profile.assigned_gate).replace(/^Gate\s+/i, "");

  return (
    <div className="hero mx-auto flex min-h-dvh max-w-md flex-col px-5 safe-bottom">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold">
          Gate {gateDisplay} · Guard {profile.guard_number}
        </p>
        <Link
          to="/guard/login"
          onClick={async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            nav("/guard/login");
          }}
          aria-label="Sign out"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-deep-foreground/70"
        >
          <LogOut className="size-5" />
        </Link>
      </div>
      <AlertsCard userId={me?.id} tone="dark" className="mt-4" />
      <p className="mt-10 text-center text-lg text-deep-foreground/70">Enter visitor code</p>
      <div className="mt-5"><PinDigits value={pin.value} /></div>
      {error && <p role="alert" className="text-center text-base font-semibold text-red-300">{error}</p>}
      <div className="mt-auto pt-10">
        <Keypad
          onDigit={(d) => {
            if (checking) return;
            setError("");
            if (pin.value.length === 5) setChecking(true);
            pin.onDigit(d);
          }}
          onBack={() => {
            if (checking) return;
            pin.onBack();
          }}
          tone="dark"
          big
        />
      </div>
    </div>
  );
}

export default Verify;
