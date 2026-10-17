import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Hero, Screen, Sheet, StatusChip } from "@/components/lh/ui";
import { formatCode, formatValidity, shareAccessCode } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";
import { formatWhen } from "@/lib/when";
import { cn } from "@/lib/utils";

export const title = "My codes";

type Row = { id: string; code: string; holder_name: string; type: string; valid_from: string; valid_to: string; active: boolean; used_at: string | null; created_at: string };
type Status = "All" | "Active" | "Used" | "Expired" | "Cancelled";
type Kind = "all" | "guest" | "long_stay";
type Period = 7 | 30 | 0;

const statusOf = (c: Row, now: Date): Exclude<Status, "All"> =>
  c.used_at ? "Used" : !c.active ? "Cancelled" : new Date(c.valid_to).getTime() > now.getTime() ? "Active" : "Expired";

function Codes() {
  const profile = useResident();
  const initial = ((useLocation().state as { status?: Status } | null)?.status ?? "All") as Status;
  const [status, setStatus] = useState<Status>(initial);
  const [kind, setKind] = useState<Kind>("all");
  const [period, setPeriod] = useState<Period>(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString();
    let q = supabase.from("access_codes").select("id,code,holder_name,type,valid_from,valid_to,active,used_at,created_at").order("created_at", { ascending: false }).limit(200);
    q = kind !== "all" ? q.eq("type", kind) : q.neq("type", "employee");
    if (period) q = q.gte("created_at", new Date(Date.now() - period * 24 * 3600_000).toISOString());
    if (status === "Active") q = q.eq("active", true).is("used_at", null).gt("valid_to", nowIso);
    if (status === "Used") q = q.not("used_at", "is", null);
    if (status === "Expired") q = q.eq("active", true).is("used_at", null).lte("valid_to", nowIso);
    if (status === "Cancelled") q = q.eq("active", false).is("used_at", null);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
  }, [status, kind, period]);

  useEffect(() => {
    if (!profile) return;
    load();
    supabase.rpc("my_code_counts").then(({ data }) => data && setCounts(data));
  }, [profile, load]);

  if (!profile) return null;
  const now = new Date();
  const unitLabel = codeToUnit(profile.house_unit);
  const pill = (on: boolean) => cn("min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold", on ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2");

  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">My codes</h1>
        {counts && (
          <div className="mt-4 grid grid-cols-4 divide-x divide-deep-foreground/15 rounded-sm bg-deep-dark/40 py-3 text-center">
            {([["Active", counts["active"]], ["Used", counts["used"]], ["Expired", (counts["expired"] ?? 0) + (counts["cancelled"] ?? 0)], ["Total", counts["total"]]] as const).map(([l, n]) => (
              <div key={l} className="px-1"><p className="font-display text-2xl font-bold">{n ?? 0}</p><p className="text-xs text-deep-foreground/70">{l}</p></div>
            ))}
          </div>
        )}
      </Hero>
      <Sheet className="space-y-4">
        <div className="scrollbar-hidden -mx-5 flex gap-2 overflow-x-auto px-5">
          {(["All", "Active", "Used", "Expired", "Cancelled"] as const).map((s) => (
            <button key={s} className={pill(status === s)} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {([["all", "All types"], ["guest", "One visit"], ["long_stay", "Long stay"]] as const).map(([k, l]) => (
            <button key={k} className={pill(kind === k)} onClick={() => setKind(k)}>{l}</button>
          ))}
          {([[7, "7 days"], [30, "30 days"], [0, "All time"]] as const).map(([p, l]) => (
            <button key={l} className={pill(period === p)} onClick={() => setPeriod(p)}>{l}</button>
          ))}
        </div>
        {rows && rows.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No codes match these filters.</p>}
        <ul className="space-y-3">
          {(rows ?? []).map((c) => {
            const st = statusOf(c, now);
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("code-digits text-2xl font-bold", st === "Active" ? "text-deep" : "text-muted-foreground")}>{formatCode(c.code)}</p>
                  <StatusChip status={st} />
                </div>
                <p className="mt-1 font-medium">
                  {c.holder_name}
                  {c.type === "long_stay" && <span className="ml-2 rounded-full bg-gold-light px-2 py-0.5 align-middle text-xs font-bold text-gold-text">Long stay</span>}
                </p>
                <p className="text-sm text-muted-foreground">{formatValidity(c, now)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Created {formatWhen(c.created_at)}</p>
                  {st === "Active" ? (
                    <button aria-label="Share" onClick={() => shareAccessCode({ code: c.code, validTo: c.valid_to, houseNumber: profile.house_number, unitLabel, type: c.type, validFrom: c.valid_from })} className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep">
                      <Share2 className="size-5" />
                    </button>
                  ) : (
                    <Link to="/create-code" state={{ holderName: c.holder_name }} className="inline-flex min-h-11 items-center rounded-sm border border-border px-3 text-sm font-semibold text-deep">Create again</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </Screen>
  );
}

export default Codes;
