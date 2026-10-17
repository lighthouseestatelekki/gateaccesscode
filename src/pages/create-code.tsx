import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { computeExpiry } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";

export const title = "Create access code";

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
        <ExpiryOptions value={sel} onChange={setSel} picked={picked} onPickedChange={setPicked} />
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button disabled={creating} onClick={handleCreate}>{creating ? "Creating…" : "Create code"}</Button>
      </Sheet>
    </Screen>
  );
}

export default CreateCode;
