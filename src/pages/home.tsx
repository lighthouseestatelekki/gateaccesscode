import { QuickDelivery } from "@/components/lh/QuickDelivery";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { Initial } from "@/components/lh/CodeTicket";
import { SetupCard } from "@/components/lh/SetupCard";
import { TodayCarousel } from "@/components/lh/TodayCarousel";
import { InsightsSnapshot } from "@/components/lh/InsightsSnapshot";
import { ExploreGrid } from "@/components/lh/ExploreGrid";
import { btnClass, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { ResidentTabs } from "@/components/lh/nav";
import { useResident } from "@/lib/useResident";
import { useInbox } from "@/lib/useInbox";
import { useMe } from "@/lib/useMe";

export const title = "Home";

type AccessCodeRow = {
  id: string;
  code: string;
  holder_name: string;
  valid_to: string;
  valid_from: string;
  type: string;
  active: boolean;
  used_at: string | null;
  created_at: string;
};

function Home() {
  const nav = useNavigate();
  const profile = useResident();
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [counts, setCounts] = useState<{ active: number; used: number; expired: number; cancelled: number; total: number } | null>(null);



  const loadCodes = useCallback(async () => {
    const { data } = await supabase
      .from("access_codes")
      .select("id,code,holder_name,valid_to,valid_from,type,active,used_at,created_at")
      .neq("type", "employee")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setCodes(data as AccessCodeRow[]);
    const { data: c } = await supabase.rpc("my_code_counts");
    if (c) setCounts(c);
  }, []);

  const me = useMe();
  useInbox(me?.id, (n) => {
    if (n.kind.startsWith("code_")) loadCodes();
  });

  useEffect(() => {
    if (!profile) return;
    loadCodes();
  }, [profile, loadCodes]);

  if (!profile) return null;

  const firstName = profile.full_name.trim().split(/\s+/)[0] ?? "";
  const unitLabel = codeToUnit(profile.house_unit);

  const recentVisitors: string[] = [];
  for (const c of codes) {
    const name = c.holder_name.trim();
    if (name && !recentVisitors.includes(name)) {
      recentVisitors.push(name);
      if (recentVisitors.length === 4) break;
    }
  }

  return (
    <Screen>
      <Hero className="pb-14">
        <div className="flex items-center justify-between">
          <Wordmark />
          <div className="-mr-2 flex items-center">
          <Link to="/sos" aria-label="SOS emergency" className="flex h-10 items-center gap-1 rounded-full bg-destructive px-3 text-sm font-bold text-white shadow-sm">
            <ShieldAlert className="size-4" /> SOS
          </Link>
          </div>
        </div>
        <div className="mt-7 flex items-center gap-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gold font-display text-2xl font-extrabold text-deep-dark ring-4 ring-white/15">{firstName[0]?.toUpperCase()}</span>
          <div className="min-w-0">
            <p className="text-sm leading-snug text-deep-foreground/75">Assalam Alaekum Waramotullahi Wabarakatu</p>
            <h1 className="truncate text-[2rem] font-extrabold leading-tight">{firstName}</h1>
          </div>
        </div>
        <div className="mt-5 flex items-stretch overflow-hidden rounded-[20px] bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
          <div className="flex flex-col justify-center border-r border-white/15 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold">House</p>
            <p className="font-display text-3xl font-extrabold leading-none">{profile.house_number}</p>
            <p className="mt-1 text-xs font-semibold text-deep-foreground/75">{unitLabel}</p>
          </div>
          <div className="grid flex-1 grid-cols-3">
            {([["Active", counts?.active, "Active"], ["Used", counts?.used, "Used"], ["Total", counts?.total, "All"]] as const).map(([l, n, st]) => (
              <Link key={l} to="/codes" state={{ status: st }} className="flex flex-col items-center justify-center py-3 hover:bg-white/5">
                <span className={`font-display text-2xl font-extrabold leading-none ${l === "Active" ? "text-gold" : ""}`}>{n ?? "–"}</span>
                <span className="mt-1 text-[11px] font-semibold text-deep-foreground/70">{l}</span>
              </Link>
            ))}
          </div>
        </div>
      </Hero>
      <Sheet className="space-y-7">
        <Link to="/create-code" className={btnClass("gold", "min-h-16 text-lg")}><span className="flex size-8 items-center justify-center rounded-full bg-deep text-gold"><Plus className="size-5" /></span> Create access code</Link>
        <QuickDelivery className="-mt-4" />

        <SetupCard userId={me?.id} hasCodes={(counts?.total ?? codes.length) > 0} />

        <TodayCarousel />

        {recentVisitors.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold">Invite again</h2>
              <p className="text-sm text-text-2">Tap a name to make a new code</p>
            </div>
            <div className="scrollbar-hidden -mx-5 flex gap-4 overflow-x-auto px-5 pb-1">
              <Link to="/create-code" className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-primary/50 text-primary"><Plus className="size-6" /></span>
                <span className="text-xs font-semibold text-deep">New</span>
              </Link>
              {recentVisitors.map((n) => (
                <button key={n} onClick={() => nav("/create-code", { state: { holderName: n } })} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <Initial name={n} className="size-14 text-xl ring-2 ring-card shadow-[0_6px_14px_-8px_var(--deep)]" />
                  <span className="w-full truncate text-center text-xs font-semibold">{n.split(/\s+/)[0]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <InsightsSnapshot />

        <ExploreGrid />
      </Sheet>
      <ResidentTabs />
    </Screen>
  );
}

export default Home;
