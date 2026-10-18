import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { defaultExpiry, ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { Initial } from "@/components/lh/CodeTicket";
import { Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { computeExpiry, formatUntil, lagosDateInput, lagosDay, lagosEndOf, lagosStartOf } from "@/lib/expiry";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useResident } from "@/lib/useResident";
import { createDeliveryPass, DELIVERY_MINUTES } from "@/lib/delivery";

export const title = "Create access code";

function CreateCode() {
  const nav = useNavigate();
  const location = useLocation();
  const profile = useResident();

  const initialName = (location.state as { holderName?: string } | null)?.holderName ?? "";
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<"guest" | "long_stay" | "delivery">("guest");
  const [sel, setSel] = useState(() => defaultExpiry());
  const [recent, setRecent] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(() => lagosDateInput());
  const [toDate, setToDate] = useState(() => lagosDateInput(new Date(), 6));
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // Recent visitors: one tap fills the name.
  useEffect(() => {
    if (!profile) return;
    supabase
      .from("access_codes")
      .select("holder_name")
      .neq("type", "employee")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const names: string[] = [];
        for (const r of (data ?? []) as { holder_name: string }[]) {
          const n = r.holder_name?.trim();
          if (n && !names.includes(n)) names.push(n);
          if (names.length === 6) break;
        }
        setRecent(names);
      });
  }, [profile]);

  const now = new Date();
  const until =
    kind === "delivery"
      ? `${DELIVERY_MINUTES} minutes from now`
      : kind === "long_stay"
      ? fromDate && toDate ? `${lagosDay(lagosStartOf(fromDate, now))} to ${lagosDay(lagosEndOf(toDate))}` : "Choose the days"
      : sel === "Pick date and time"
        ? picked ? formatUntil(computeExpiry(sel, now, picked), now) : "Choose a date and time"
        : formatUntil(computeExpiry(sel, now), now);

  async function handleCreate() {
    if (kind === "delivery") {
      setError("");
      setCreating(true);
      try {
        nav("/code-created", { state: await createDeliveryPass() });
      } catch (e) {
        setError((e as Error).message);
        setCreating(false);
      }
      return;
    }
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
      <Hero className="pb-12">
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Create access code</h1>
        {/* The visitor's pass, filling in as you choose. The code itself appears once it's created. */}
        <div className="mt-4 rounded-[20px] bg-white/10 p-4 ring-1 ring-white/15">
          <div className="flex items-center gap-3">
            {kind === "delivery" ? <Initial name="Delivery" className="size-11 text-lg" /> : name.trim() ? <Initial name={name} className="size-11 text-lg" /> : <span className="flex size-11 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">?</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold leading-tight">{kind === "delivery" ? "Delivery" : name.trim() || "Visitor name"}</p>
              <p className="text-sm text-deep-foreground/75">{kind === "long_stay" ? "Long stay · come and go" : kind === "delivery" ? "Quick delivery · in and out" : "One visit"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-white/25 pt-3">
            <p className="code-digits text-2xl font-bold text-gold" aria-hidden="true">••• •••</p>
            <p className="text-right text-xs font-semibold text-deep-foreground/80">{until}</p>
          </div>
        </div>
      </Hero>
      <Sheet className="space-y-5">
        {kind !== "delivery" && <div>
          <Field label="Visitor name" placeholder="e.g. Ibrahim Yusuf" value={name} onChange={(e) => setName(e.target.value)} />
          {recent.length > 0 && (
            <div className="scrollbar-hidden -mx-5 mt-2 flex gap-2 overflow-x-auto px-5" aria-label="Recent visitors">
              {recent.map((n) => (
                <button key={n} type="button" onClick={() => setName(n)} className={cn("flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-medium", name.trim() === n ? "border-primary bg-mint-light text-deep" : "border-border bg-card")}>
                  <Initial name={n} className="size-7 text-xs" />{n}
                </button>
              ))}
            </div>
          )}
        </div>}
        <div>
          <p className="mb-2 text-sm font-medium text-text-2">Type of visit</p>
          <div role="radiogroup" aria-label="Type of visit" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
            {([["guest", "One visit"], ["long_stay", "Long stay"], ["delivery", "Delivery"]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(""); }} className={cn("min-h-12 rounded-xl text-base font-semibold transition-colors", kind === k ? "bg-card text-deep shadow-sm" : "text-text-2")}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {kind === "guest" ? "Works for one entry and one exit." : kind === "delivery" ? `No typing needed. Works for ${DELIVERY_MINUTES} minutes: one entry and one exit.` : "They can come and go as often as needed, for up to 30 days."}
          </p>
        </div>
        {kind === "delivery" ? null : kind === "guest" ? (
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
        <Button disabled={creating} onClick={handleCreate}>{creating ? "Creating…" : kind === "delivery" ? "Create delivery pass" : "Create code"}</Button>
      </Sheet>
    </Screen>
  );
}

export default CreateCode;
