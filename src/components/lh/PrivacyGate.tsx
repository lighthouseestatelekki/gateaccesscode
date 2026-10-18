import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { PRIVACY_VERSION } from "@/lib/privacy";

const SKIP = /^\/(privacy|join|login|register|guard\/login|manager)(\/|$)|^\/$/;

/** One-time: residents and guards agree to the privacy notice (again if it changes). */
export function PrivacyGate() {
  const me = useMe();
  const { pathname } = useLocation();
  const [need, setNeed] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = me?.id;
  const role = me?.role;
  useEffect(() => {
    setNeed(false);
    if (!id || (role !== "resident" && role !== "guard")) return;
    supabase.from("profiles").select("privacy_version").eq("id", id).maybeSingle().then(({ data, error }) => {
      // Before the database update is run the column does not exist: let people carry on.
      if (error || !data) return;
      setNeed(((data as { privacy_version: number | null }).privacy_version ?? 0) < PRIVACY_VERSION);
    });
  }, [id, role]);

  if (!need || SKIP.test(pathname)) return null;

  async function agree() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_privacy", { p_version: PRIVACY_VERSION });
    setBusy(false);
    if (!error) setNeed(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-deep-dark/60">
      <div role="dialog" aria-label="Privacy notice" className="w-full max-w-md rounded-t-sheet bg-card px-5 pb-6 pt-5 safe-bottom animate-in slide-in-from-bottom duration-300">
        <ShieldCheck className="size-10 text-primary" />
        <h2 className="mt-3 text-2xl font-semibold">Your privacy</h2>
        <p className="mt-2 text-text-2">We keep only what's needed for gate security: your details, the codes you create and when they're used at the gate. Gate records are deleted after 24 months, and your details 90 days after you move out. We never sell your data.</p>
        <Link to="/privacy" className="mt-2 inline-flex min-h-11 items-center font-semibold text-deep underline">Read the full privacy notice</Link>
        <Button className="mt-3" disabled={busy} onClick={agree}>{busy ? "Saving…" : "I understand and agree"}</Button>
      </div>
    </div>
  );
}
