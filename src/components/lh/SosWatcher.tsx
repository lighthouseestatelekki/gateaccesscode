import { Link, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Phone, ShieldAlert } from "lucide-react";
import { codeToUnit } from "@/lib/units";
import { supabase } from "@/lib/supabase";
import { startAlarm, useOpenSos, type Sos } from "@/lib/useSos";
import { useMe } from "@/lib/useMe";
import { formatWhen } from "@/lib/when";

/**
 * Shown on every screen for anyone signed in:
 *  - Guards get a full-screen red alert (with sound) until they acknowledge.
 *  - Everyone else gets a red banner with house, name and phone while the SOS is open.
 *  - Guards and the Estate Manager can mark it resolved or a false alarm.
 */
export function SosWatcher() {
  const me = useMe();
  const { pathname } = useLocation();
  const { list, reload } = useOpenSos(!!me);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const staff = me?.role === "guard" || me?.role === "estate_manager";
  const urgent = me?.role === "guard" ? list.find((s) => s.status === "active") : undefined;

  const stopRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (urgent && !stopRef.current) stopRef.current = startAlarm();
    if (!urgent && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  }, [urgent]);
  useEffect(() => () => stopRef.current?.(), []);

  const bannerRef = useRef<HTMLDivElement>(null);
  const showBanner = !!me && list.length > 0 && !urgent;
  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!showBanner || !el) {
      document.body.style.paddingTop = "";
      return;
    }
    const set = () => (document.body.style.paddingTop = `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.body.style.paddingTop = "";
    };
  });

  if (!me || list.length === 0) return null;

  async function act(fn: string, args: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    const { error: err } = await supabase.rpc(fn, args);
    setBusy(null);
    if (err) setError(err.message);
    reload();
  }

  const where = (s: Sos) => `House ${s.house_number} · ${codeToUnit(s.house_unit)}`;

  if (urgent) {
    return (
      <div role="alertdialog" aria-label="SOS alert" className="fixed inset-0 z-[60] flex flex-col bg-destructive px-6 text-center text-white safe-top safe-bottom">
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="relative mb-6 flex size-28 items-center justify-center rounded-full border-[6px] border-white/50 bg-black/10">
            <span aria-hidden className="absolute inset-0 rounded-full bg-white/20 motion-safe:animate-ping" />
            <ShieldAlert className="relative size-14" strokeWidth={2.5} />
          </span>
          <h1 className="text-6xl font-extrabold tracking-tight">SOS</h1>
          <p className="mt-4 text-3xl font-bold">{where(urgent)}</p>
          <p className="mt-2 text-2xl font-semibold">{urgent.full_name}</p>
          {urgent.phone && (
            <a href={`tel:${urgent.phone}`} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-xl font-semibold">
              <Phone className="size-5" /> {urgent.phone}
            </a>
          )}
          <p className="mt-3 text-base opacity-85">{formatWhen(urgent.created_at)}</p>
        </div>
        {error && <p role="alert" className="mb-2 font-semibold">{error}</p>}
        <button
          disabled={busy !== null}
          onClick={() => act("acknowledge_sos", { p_id: urgent.id }, "ack")}
          className="mb-4 min-h-18 w-full rounded-lg bg-white text-xl font-bold text-destructive disabled:opacity-60"
        >
          {busy === "ack" ? "Sending…" : "Acknowledge"}
        </button>
      </div>
    );
  }

  return (
    <div ref={bannerRef} className="fixed inset-x-0 top-0 z-50 mx-auto max-w-md space-y-1 bg-deep-dark px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
      {list.map((s) => {
        const mine = s.raised_by === me.id;
        return (
          <div key={s.id} role="alert" className="rounded-lg bg-destructive px-4 py-3 text-white shadow-lg">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">SOS · {where(s)}</p>
                <p className="text-sm">
                  {s.full_name}
                  {s.phone && (
                    <>
                      {" · "}
                      <a className="underline" href={`tel:${s.phone}`}>{s.phone}</a>
                    </>
                  )}
                </p>
                <p className="text-sm opacity-90">
                  {s.status === "acknowledged" ? `${s.acknowledged_by_name ?? "Security"} is responding` : "Waiting for security…"}
                </p>
              </div>
              {mine && pathname !== "/sos" && <Link to="/sos" className="shrink-0 self-center rounded-full bg-white/20 px-3 py-2 text-sm font-semibold">Open</Link>}
            </div>
            {staff && (
              <div className="mt-2 flex gap-2">
                {s.status === "active" && (
                  <button disabled={busy !== null} onClick={() => act("acknowledge_sos", { p_id: s.id }, s.id + "a")} className="min-h-11 flex-1 rounded-sm bg-white text-sm font-bold text-destructive">Acknowledge</button>
                )}
                <button disabled={busy !== null} onClick={() => act("close_sos", { p_id: s.id, p_outcome: "resolved" }, s.id + "r")} className="min-h-11 flex-1 rounded-sm bg-white/20 text-sm font-bold">Resolved</button>
                <button disabled={busy !== null} onClick={() => act("close_sos", { p_id: s.id, p_outcome: "false_alarm" }, s.id + "f")} className="min-h-11 flex-1 rounded-sm bg-white/20 text-sm font-bold">False alarm</button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p role="alert" className="rounded-sm bg-white px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
