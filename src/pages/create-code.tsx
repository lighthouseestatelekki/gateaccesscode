import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { computeExpiry } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";
import { cn } from "@/lib/utils";

export const title = "Create access code";

const OPTIONS = ["Next 2 hours", "Today", "Tomorrow", "This weekend", "Pick date and time"];

function CreateCode() {
  const nav = useNavigate();
  const location = useLocation();
  useResident();

  const initialName = (location.state as { holderName?: string } | null)?.holderName ?? "";
  const [name, setName] = useState(initialName);
  const [sel, setSel] = useState("Today");
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter the visitor's name.");
      return;
    }

    const now = new Date();
    const expiry = computeExpiry(sel, now, picked);
    if (sel === "Pick date and time") {
      if (!picked.trim() || Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
        setError("Please choose a time in the future.");
        return;
      }
    }

    setError("");
    setCreating(true);

    const { data, error: rpcError } = await supabase.rpc("create_guest_code", {
      p_holder_name: trimmed,
      p_valid_to: expiry.toISOString(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setCreating(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    nav("/code-created", {
      state: {
        code: row.code,
        holder_name: row.holder_name,
        valid_to: row.valid_to,
      },
    });
  }

  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Create access code</h1>
      </Hero>
      <Sheet className="space-y-6">
        <Field label="Visitor name" placeholder="e.g. Ibrahim Yusuf" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="mb-2 text-sm font-medium text-text-2">Valid until</p>
          <div className="space-y-2">
            {OPTIONS.map((o) => (
              <button key={o} onClick={() => setSel(o)} className={cn("flex min-h-14 w-full items-center justify-between rounded-lg border-2 px-5 text-left text-base font-semibold transition-colors", sel === o ? "border-primary bg-mint-lightest text-deep" : "border-border bg-card text-foreground")}>
                {o}
                <span className={cn("flex size-6 items-center justify-center rounded-full border-2", sel === o ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{sel === o && <Check className="size-4" />}</span>
              </button>
            ))}
          </div>
          {sel === "Pick date and time" && (
            <input
              type="datetime-local"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-3 h-12 w-full rounded-sm border border-border bg-card px-4"
            />
          )}
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button disabled={creating} onClick={handleCreate}>{creating ? "Creating…" : "Create code"}</Button>
      </Sheet>
    </Screen>
  );
}

export default CreateCode;
