import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { computeExpiry, lagosDateInput, lagosEndOf, lagosStartOf } from "@/lib/expiry";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";

export const title = "Create access code";

function CreateCode() {
  const nav = useNavigate();
  const location = useLocation();
  useResident();

  const initialName = (location.state as { holderName?: string } | null)?.holderName ?? "";
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<"guest" | "long_stay">("guest");
  const [sel, setSel] = useState("Today");
  const [fromDate, setFromDate] = useState(() => lagosDateInput());
  const [toDate, setToDate] = useState(() => lagosDateInput(new Date(), 6));
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
    if (kind === "long_stay") {
      if (!fromDate || !toDate) {
        setError("Please choose the first and last day of the stay.");
        return;
      }
      const from = lagosStartOf(fromDate, now);
      const to = lagosEndOf(toDate);
      if (to.getTime() <= from.getTime()) {
        setError("The last day must be on or after the first day.");
        return;
      }
      if (to.getTime() - from.getTime() > 30 * 24 * 3600_000 + 60_000) {
        setError("A Long Stay code can last at most 30 days.");
        return;
      }
      setError("");
      setCreating(true);
      const { data, error: rpcError } = await supabase.rpc("create_long_stay_code", {
        p_holder_name: trimmed,
        p_valid_from: from.toISOString(),
        p_valid_to: to.toISOString(),
      });
      if (rpcError) {
        setError(rpcError.message);
        setCreating(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      nav("/code-created", { state: { code: row.code, holder_name: row.holder_name, valid_to: row.valid_to, valid_from: row.valid_from, type: row.type } });
      return;
    }
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
        valid_from: row.valid_from,
        type: row.type,
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
          <p className="mb-2 text-sm font-medium text-text-2">Type of visit</p>
          <div role="radiogroup" aria-label="Type of visit" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {([["guest", "One visit"], ["long_stay", "Long stay"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(""); }} className={cn("min-h-12 rounded-xl text-base font-semibold transition-colors", kind === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {kind === "guest" ? "Works for one entry and one exit." : "They can come and go as often as needed, for up to 30 days."}
          </p>
        </div>
        {kind === "guest" ? (
          <ExpiryOptions value={sel} onChange={setSel} picked={picked} onPickedChange={setPicked} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">First day</span>
              <input type="date" value={fromDate} min={lagosDateInput()} onChange={(e) => setFromDate(e.target.value)} className="h-13 min-h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">Last day</span>
              <input type="date" value={toDate} min={fromDate || lagosDateInput()} onChange={(e) => setToDate(e.target.value)} className="h-13 min-h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            </label>
            <p className="col-span-2 -mt-1 text-sm text-muted-foreground">Works from the start of the first day until 11:59 PM on the last day.</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button disabled={creating} onClick={handleCreate}>{creating ? "Creating…" : "Create code"}</Button>
      </Sheet>
    </Screen>
  );
}

export default CreateCode;
