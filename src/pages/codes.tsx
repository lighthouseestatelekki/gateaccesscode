import { QuickDelivery } from "@/components/lh/QuickDelivery";
import { useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet, Button, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { CodeTicket } from "@/components/lh/CodeTicket";
import { computeExpiry, shareAccessCode } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { ResidentTabs } from "@/components/lh/nav";
import { useResident } from "@/lib/useResident";
import { cn } from "@/lib/utils";

export const title = "My codes";

type Row = { id: string; code: string; holder_name: string; type: string; valid_from: string; valid_to: string; active: boolean; used_at: string | null; created_at: string };
type Status = "All" | "Active" | "Used" | "Expired" | "Cancelled";
type Kind = "all" | "guest" | "long_stay";
type Period = 7 | 30 | 0;


function Codes() {
  const profile = useResident();
  const initial = ((useLocation().state as { status?: Status } | null)?.status ?? "All") as Status;
  const [status, setStatus] = useState<Status>(initial);
  const [kind, setKind] = useState<Kind>("all");
  const [period, setPeriod] = useState<Period>(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [extendTarget, setExtendTarget] = useState<Row | null>(null);
  const [extendOption, setExtendOption] = useState("Tomorrow");
  const [extendPicked, setExtendPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString();
    let q = supabase.from("access_codes").select("id,code,holder_name,type,valid_from,valid_to,active,used_at,created_at").order("created_at", { ascending: false }).limit(200);
    q = kind !== "all" ? q.eq("type", kind) : q.neq("type", "employee");
    if (period) q = q.gte("created_at", new Date(Date.now() - period * 24 * 3600_000).toISOString());
    if (status === "Active") q = q.eq("active", true).is("used_at", null).gt("valid_to", nowIso);
    if (status === "Used") q = q.not("used_at", "is", null);
    if (status === "Expired") q = q.is("used_at", null).or(`active.eq.false,valid_to.lte.${nowIso}`);
    if (status === "Cancelled") q = q.eq("active", false).is("used_at", null);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
  }, [status, kind, period]);

  const refresh = useCallback(() => {
    load();
    supabase.rpc("my_code_counts").then(({ data }) => data && setCounts(data));
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    setSheetError("");
    const { error } = await supabase.rpc("cancel_my_code", { p_code_id: cancelTarget.id });
    setBusy(false);
    if (error) return setSheetError(error.message);
    setCancelTarget(null);
    refresh();
  }

  async function handleExtend() {
    if (!extendTarget) return;
    const now = new Date();
    const expiry = computeExpiry(extendOption, now, extendPicked);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime() || expiry.getTime() <= new Date(extendTarget.valid_to).getTime()) {
      return setSheetError("Please choose a later time.");
    }
    setBusy(true);
    setSheetError("");
    const { error } = await supabase.rpc("extend_my_code", { p_code_id: extendTarget.id, p_valid_to: expiry.toISOString() });
    setBusy(false);
    if (error) return setSheetError(error.message);
    setExtendTarget(null);
    refresh();
  }

  if (!profile) return null;
  const now = new Date();
  const unitLabel = codeToUnit(profile.house_unit);

  const tabs = [
    ["All", counts?.["total"]],
    ["Active", counts?.["active"]],
    ["Used", counts?.["used"]],
    ["Expired", (counts?.["expired"] ?? 0) + (counts?.["cancelled"] ?? 0)],
  ] as const;
  const chipSelect = "lh-select min-h-10 appearance-none rounded-full bg-mint-lightest bg-[length:14px] bg-[right_12px_center] bg-no-repeat pl-4 pr-9 text-sm font-semibold text-deep";
  const caret = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23123528' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" };

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">My codes</h1>
        <p className="mt-1 text-deep-foreground/70">Tap a box to filter</p>
        <div role="tablist" aria-label="Status" className="mt-4 grid grid-cols-4 gap-1.5 rounded-[20px] bg-black/15 p-1.5">
          {tabs.map(([l, n]) => {
            const on = status === l || (l === "Expired" && status === "Cancelled");
            return (
              <button key={l} role="tab" aria-selected={on} onClick={() => setStatus(l)} className={cn("flex flex-col items-center rounded-2xl py-2.5 transition-colors", on ? "bg-card text-deep shadow-sm" : "text-deep-foreground")}>
                <span className={cn("font-display text-2xl font-extrabold leading-none", on && l === "Active" && "text-primary")}>{counts ? (n ?? 0) : "–"}</span>
                <span className={cn("mt-1 text-xs font-semibold", on ? "text-text-2" : "text-deep-foreground/70")}>{l}</span>
              </button>
            );
          })}
        </div>
      </Hero>
      <Sheet className="space-y-4">
        <QuickDelivery variant="chip" />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="kind">Type</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={chipSelect} style={caret}>
            <option value="all">All types</option>
            <option value="guest">One visit</option>
            <option value="long_stay">Long stay</option>
          </select>
          <label className="sr-only" htmlFor="period">Period</label>
          <select id="period" value={period} onChange={(e) => setPeriod(Number(e.target.value) as Period)} className={chipSelect} style={caret}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={0}>All time</option>
          </select>
        </div>
        {rows && rows.length === 0 && (
          <div className="rounded-[22px] border-2 border-dashed border-border p-6 text-center">
            <p className="font-semibold">Nothing here</p>
            <p className="mt-1 text-sm text-text-2">No codes match these filters.</p>
          </div>
        )}
        <ul className="space-y-3">
          {(rows ?? []).map((c) => (
            <CodeTicket
              key={c.id}
              c={c}
              now={now}
              showCreated
              onShare={() => shareAccessCode({ code: c.code, validTo: c.valid_to, houseNumber: profile.house_number, hostName: profile.full_name, unitLabel, type: c.type, validFrom: c.valid_from })}
              onExtend={() => { setExtendTarget(c); setExtendOption("Tomorrow"); setExtendPicked(""); setSheetError(""); }}
              onCancel={() => { setCancelTarget(c); setSheetError(""); }}
            />
          ))}
        </ul>
      </Sheet>
      <BottomSheet open={Boolean(cancelTarget)} onClose={() => !busy && setCancelTarget(null)} title="Cancel this code?">
        <div className="space-y-3 pb-4">
          <p className="text-base text-text-2">Your visitor will not be able to use this code.</p>
          {sheetError && <p role="alert" className="text-sm font-medium text-destructive">{sheetError}</p>}
          <Button variant="danger" disabled={busy} onClick={handleCancel}>{busy ? "Cancelling…" : "Yes, cancel code"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setCancelTarget(null)}>Keep code</Button>
        </div>
      </BottomSheet>
      <BottomSheet open={Boolean(extendTarget)} onClose={() => !busy && setExtendTarget(null)} title="Extend code">
        <div className="space-y-4 pb-4">
          <ExpiryOptions value={extendOption} onChange={setExtendOption} picked={extendPicked} onPickedChange={setExtendPicked} />
          {sheetError && <p role="alert" className="text-sm font-medium text-destructive">{sheetError}</p>}
          <Button disabled={busy} onClick={handleExtend}>{busy ? "Extending…" : "Extend code"}</Button>
        </div>
      </BottomSheet>
      <ResidentTabs />
    </Screen>
  );
}

export default Codes;
