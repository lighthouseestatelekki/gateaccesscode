import { QuickDelivery } from "@/components/lh/QuickDelivery";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { CodeTicket, Initial } from "@/components/lh/CodeTicket";
import { ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { SetupCard } from "@/components/lh/SetupCard";
import { PrayerCard } from "@/components/lh/PrayerCard";
import { BottomSheet, Button, btnClass, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";
import { computeExpiry, shareAccessCode } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { ResidentTabs } from "@/components/lh/nav";
import { useResident } from "@/lib/useResident";
import { useInbox } from "@/lib/useInbox";
import { useMe } from "@/lib/useMe";
import { dailyHadith, HADITH_ATTRIBUTION, hadith } from "@/mock/hadith";

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
  const [h, setH] = useState(hadith[0]!);
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [counts, setCounts] = useState<{ active: number; used: number; expired: number; cancelled: number; total: number } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<AccessCodeRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [extendTarget, setExtendTarget] = useState<AccessCodeRow | null>(null);
  const [extendOption, setExtendOption] = useState("Tomorrow");
  const [extendPicked, setExtendPicked] = useState("");
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState("");

  useEffect(() => setH(dailyHadith()!), []);

  const loadCodes = useCallback(async () => {
    const { data } = await supabase
      .from("access_codes")
      .select("id,code,holder_name,valid_to,valid_from,type,active,used_at,created_at")
      .neq("type", "employee")
      .order("created_at", { ascending: false })
      .limit(5);
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

  const now = new Date();

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelError("");
    setCancelling(true);

    const { error } = await supabase.rpc("cancel_my_code", { p_code_id: cancelTarget.id });
    if (error) {
      setCancelError(error.message);
      setCancelling(false);
      return;
    }

    setCancelling(false);
    setCancelTarget(null);
    await loadCodes();
  }

  async function handleExtend() {
    if (!extendTarget) return;
    const currentNow = new Date();
    const expiry = computeExpiry(extendOption, currentNow, extendPicked);
    const currentValidTo = new Date(extendTarget.valid_to);

    if (
      Number.isNaN(expiry.getTime()) ||
      expiry.getTime() <= currentNow.getTime() ||
      expiry.getTime() <= currentValidTo.getTime()
    ) {
      setExtendError("Please choose a later time.");
      return;
    }

    setExtendError("");
    setExtending(true);

    const { error } = await supabase.rpc("extend_my_code", {
      p_code_id: extendTarget.id,
      p_valid_to: expiry.toISOString(),
    });

    if (error) {
      setExtendError(error.message);
      setExtending(false);
      return;
    }

    setExtending(false);
    setExtendTarget(null);
    await loadCodes();
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

        <PrayerCard />

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

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold">Latest codes</h2>
              {counts && counts.active > 0 && <p className="text-sm text-text-2">{counts.active} working right now</p>}
            </div>
            {counts && counts.total > 0 && <Link to="/codes" className="inline-flex min-h-11 items-center text-sm font-bold text-primary">See all</Link>}
          </div>
          {codes.length === 0 ? (
            <div className="rounded-[22px] border-2 border-dashed border-border p-6 text-center">
              <p className="font-semibold">No codes yet</p>
              <p className="mt-1 text-sm text-text-2">Create one above and share it with your visitor.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {codes.map((c) => (
                <CodeTicket
                  key={c.id}
                  c={c}
                  now={now}
                  onShare={() =>
                    shareAccessCode({ code: c.code, validTo: c.valid_to, houseNumber: profile.house_number, hostName: profile.full_name, unitLabel, type: c.type, validFrom: c.valid_from })
                  }
                  onExtend={() => {
                    setExtendTarget(c);
                    setExtendOption("Tomorrow");
                    setExtendPicked("");
                    setExtendError("");
                    setExtending(false);
                  }}
                  onCancel={() => {
                    setCancelTarget(c);
                    setCancelError("");
                    setCancelling(false);
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="deep-card relative overflow-hidden rounded-lg p-6">
          <span aria-hidden className="pointer-events-none absolute -top-3 right-4 font-display text-9xl font-extrabold leading-none text-gold/25">”</span>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Daily hadith</p>
          <p className="relative mt-3 font-display text-xl font-medium leading-snug text-white">“{h.text}”</p>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <p className="text-xs leading-6 text-gold/90">{HADITH_ATTRIBUTION}</p>
            <Link to="/hadith" className="shrink-0 py-2 text-sm font-bold text-primary">More hadith</Link>
          </div>
        </section>
      </Sheet>
      <BottomSheet
        open={Boolean(cancelTarget)}
        onClose={() => {
          if (!cancelling) {
            setCancelTarget(null);
            setCancelError("");
          }
        }}
        title="Cancel this code?"
      >
        <div className="space-y-3 pb-4">
          <p className="text-base text-text-2">Your visitor will not be able to use this code.</p>
          {cancelError && <p role="alert" className="text-sm font-medium text-destructive">{cancelError}</p>}
          <Button variant="danger" disabled={cancelling} onClick={handleCancel}>
            {cancelling ? "Cancelling…" : "Yes, cancel code"}
          </Button>
          <Button
            variant="outline"
            disabled={cancelling}
            onClick={() => {
              setCancelTarget(null);
              setCancelError("");
            }}
          >
            Keep code
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={Boolean(extendTarget)}
        onClose={() => {
          if (!extending) {
            setExtendTarget(null);
            setExtendError("");
          }
        }}
        title="Extend code"
      >
        <div className="space-y-4 pb-4">
          <ExpiryOptions
            value={extendOption}
            onChange={setExtendOption}
            picked={extendPicked}
            onPickedChange={setExtendPicked}
          />
          {extendError && <p role="alert" className="text-sm font-medium text-destructive">{extendError}</p>}
          <Button disabled={extending} onClick={handleExtend}>
            {extending ? "Extending…" : "Extend code"}
          </Button>
        </div>
      </BottomSheet>
      <ResidentTabs />
    </Screen>
  );
}

export default Home;
