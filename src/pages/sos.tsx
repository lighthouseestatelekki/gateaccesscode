import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button, Screen } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";
import { useMe } from "@/lib/useMe";
import { useOpenSos } from "@/lib/useSos";

export const title = "SOS";

const HOLD_MS = 5000;

function SosPage() {
  const profile = useResident();
  const me = useMe();
  const { list, reload } = useOpenSos(!!me);
  const mine = me ? list.find((s) => s.raised_by === me.id) : undefined;
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  async function fire() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("raise_sos");
    setBusy(false);
    setProgress(0);
    if (err) setError(err.message);
    reload();
  }

  function tick() {
    if (start.current === null) return;
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      start.current = null;
      try {
        navigator.vibrate?.(400);
      } catch {
        /* ignore */
      }
      fire();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }
  function down(e: React.PointerEvent) {
    if (busy || mine) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = performance.now();
    try {
      navigator.vibrate?.(60);
    } catch {
      /* ignore */
    }
    raf.current = requestAnimationFrame(tick);
  }
  function up() {
    if (start.current !== null) {
      start.current = null;
      if (raf.current) cancelAnimationFrame(raf.current);
      setProgress(0);
    }
  }

  async function cancelMine() {
    if (!mine) return;
    setBusy(true);
    const { error: err } = await supabase.rpc("cancel_my_sos", { p_id: mine.id });
    setBusy(false);
    if (err) setError(err.message);
    reload();
  }

  if (!profile) return null;
  const secondsLeft = Math.ceil((1 - progress) * (HOLD_MS / 1000));
  const R = 118;
  const C = 2 * Math.PI * R;

  return (
    <Screen className="bg-deep-dark text-white">
      <div className="flex min-h-dvh flex-col px-5 safe-top safe-bottom">
        <Link to="/home" aria-label="Back" className="-ml-2 mt-2 flex size-11 items-center justify-center rounded-full text-white/80"><ArrowLeft className="size-6" /></Link>
        {mine ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="relative flex size-36 items-center justify-center rounded-full bg-destructive">
              <span aria-hidden className="absolute inset-0 rounded-full bg-destructive/60 motion-safe:animate-ping" />
              <ShieldAlert className="relative size-16" />
            </span>
            <h1 className="mt-8 text-4xl font-extrabold">SOS sent</h1>
            <p className="mt-3 max-w-xs text-lg text-white/85">
              {mine.status === "acknowledged" ? `${mine.acknowledged_by_name ?? "Security"} is responding. Stay where you are if it is safe.` : "Security, the Estate Manager and your neighbours have been alerted."}
            </p>
            <p className="mt-2 text-white/60">House {mine.house_number} · {mine.full_name}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-3xl font-extrabold">Emergency SOS</h1>
            <p className="mt-2 max-w-xs text-white/75">Hold the button for 5 seconds. Security, the Estate Manager and all residents will see your house, name and phone.</p>
            <div className="relative mt-10 size-64">
              <svg viewBox="0 0 256 256" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="128" cy="128" r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="12" />
                <circle cx="128" cy="128" r={R} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
              </svg>
              <button
                aria-label="Hold for 5 seconds to send SOS"
                onPointerDown={down}
                onPointerUp={up}
                onPointerLeave={up}
                onPointerCancel={up}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute inset-5 flex select-none flex-col items-center justify-center rounded-full bg-destructive text-white shadow-[0_20px_60px_-15px_var(--destructive)] active:scale-[0.98]"
                style={{ touchAction: "none", WebkitUserSelect: "none" }}
              >
                <ShieldAlert className="size-14" />
                <span className="mt-2 text-3xl font-extrabold">{busy ? "Sending…" : progress > 0 ? secondsLeft : "SOS"}</span>
                <span className="text-sm font-semibold opacity-85">{progress > 0 ? "Keep holding" : "Hold 5 seconds"}</span>
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mb-3 text-center font-semibold text-red-300">{error}</p>}
        {mine && (
          <Button variant="outline" disabled={busy} onClick={cancelMine} className="mb-4 border-0">
            {busy ? "Cancelling…" : "I'm safe — cancel SOS"}
          </Button>
        )}
      </div>
    </Screen>
  );
}

export default SosPage;
