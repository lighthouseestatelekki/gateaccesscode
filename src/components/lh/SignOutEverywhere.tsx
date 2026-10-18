import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

/** Estate Manager: end every sign-in this person has (lost or stolen phone). Asks once to confirm. */
export function SignOutEverywhere({ userId, name, onDone }: { userId: string; name: string; onDone?: () => void }) {
  const [stage, setStage] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function run() {
    setStage("busy");
    setError("");
    const { error: err } = await supabase.rpc("revoke_user_sessions", { p_user: userId });
    if (err) {
      setError(err.message);
      setStage("confirm");
      return;
    }
    setStage("done");
    onDone?.();
  }

  if (stage === "done") {
    return <p role="status" className="rounded-2xl bg-mint-lightest p-3 text-sm font-medium text-deep">{name} has been signed out of every phone. They can sign in again with their PIN.</p>;
  }
  return (
    <div className="space-y-2">
      {stage === "idle" ? (
        <button onClick={() => setStage("confirm")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-destructive/40 font-semibold text-destructive">
          <LogOut className="size-5" /> Sign out of all devices
        </button>
      ) : (
        <div className="rounded-2xl bg-destructive-light p-3">
          <p className="text-sm font-medium text-destructive">Sign {name} out of every phone now? Use this for a lost or stolen phone.</p>
          <div className="mt-2 flex gap-2">
            <button disabled={stage === "busy"} onClick={run} className="min-h-11 flex-1 rounded-full bg-destructive font-bold text-white">{stage === "busy" ? "Signing out…" : "Yes, sign out"}</button>
            <button disabled={stage === "busy"} onClick={() => setStage("idle")} className="min-h-11 flex-1 rounded-full bg-card font-semibold">Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
