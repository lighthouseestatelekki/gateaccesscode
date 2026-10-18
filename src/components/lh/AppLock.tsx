import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Keypad, PinBoxes, usePin, Wordmark } from "@/components/lh/ui";
import { markActive, shouldLock, unlockWithPin } from "@/lib/applock";
import { codeToUnit } from "@/lib/units";
import { useMe } from "@/lib/useMe";
import { supabase } from "@/lib/supabase";

const RESIDENT_SCREENS = /^\/(home|codes|staff|inbox|more|insights|hadith|fixit|household|create-code|code-created|sos)(\/|$)/;

/** Covers resident screens with a PIN pad after the app has been left unused for a few hours. */
export function AppLock() {
  const me = useMe();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [locked, setLocked] = useState(() => shouldLock());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Signed in again on the sign-in screen? That counts as unlocking.
  useEffect(() => {
    if (locked && !shouldLock()) setLocked(false);
  }, [pathname, locked]);

  // Remember activity while the app is in use; re-check when it comes back to the screen.
  useEffect(() => {
    let last = 0;
    const touch = () => {
      if (locked) return;
      const now = Date.now();
      if (now - last > 30_000) {
        last = now;
        markActive(now);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (shouldLock()) setLocked(true);
      } else if (!locked) markActive();
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [locked]);

  const pin = usePin(async (v) => {
    if (!me?.house_number || !me.house_unit) return;
    setBusy(true);
    setError("");
    try {
      await unlockWithPin({ userId: me.id, house_number: me.house_number, house_unit: me.house_unit, pin: v });
      setLocked(false);
    } catch (e) {
      setError((e as Error).message);
      pin.reset();
    }
    setBusy(false);
  });

  const show = locked && me?.role === "resident" && RESIDENT_SCREENS.test(pathname);
  if (!show) return null;
  const first = me.full_name.trim().split(/\s+/)[0];

  return (
    <div role="dialog" aria-modal="true" aria-label="App locked" className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col bg-background">
      <header className="hero px-5 pb-12 pt-6 text-deep-foreground safe-top">
        <Wordmark />
        <div className="mt-8 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-gold text-deep-dark"><Lock className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-extrabold">Welcome back, {first}</h1>
            <p className="text-sm text-deep-foreground/80">House {me.house_number} · {codeToUnit(me.house_unit ?? "")}</p>
          </div>
        </div>
      </header>
      <main className="sheet flex flex-1 flex-col gap-5 px-5 pt-6">
        <h2 className="text-center text-lg font-bold">{busy ? "Checking…" : "Enter your PIN to continue"}</h2>
        <PinBoxes value={pin.value} />
        {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
        <Keypad onDigit={(d) => { if (!busy) { setError(""); pin.onDigit(d); } }} onBack={pin.onBack} />
        <p className="text-center text-xs text-muted-foreground">For your safety the app locks after a few hours unused.</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            setLocked(false);
            nav("/login", { replace: true });
          }}
          className="mx-auto min-h-11 px-4 text-sm font-semibold text-text-2 underline underline-offset-4"
        >
          Not {first}? Sign out
        </button>
      </main>
    </div>
  );
}
