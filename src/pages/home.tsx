import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Bell, LogOut, Plus, Share2, ShieldAlert, X } from "lucide-react";
import { ExpiryOptions } from "@/components/lh/ExpiryOptions";
import { AlertsCard } from "@/components/lh/AlertsCard";
import { BottomSheet, Button, btnClass, Hero, Screen, Sheet, StatusChip, Wordmark } from "@/components/lh/ui";
import { computeExpiry, formatCode, formatUntil, formatValidity, shareAccessCode } from "@/lib/expiry";
import { isInstalled, promptInstall } from "@/lib/install";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
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

function getCodeStatus(c: AccessCodeRow, now: Date): "Active" | "Used" | "Expired" | "Cancelled" {
  if (c.used_at) return "Used";
  if (!c.active) return "Cancelled";
  if (new Date(c.valid_to).getTime() > now.getTime()) return "Active";
  return "Expired";
}

function Home() {
  const nav = useNavigate();
  const profile = useResident();
  const [banner, setBanner] = useState(() => !isInstalled());
  const [how, setHow] = useState(false);
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
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setCodes(data as AccessCodeRow[]);
    const { data: c } = await supabase.rpc("my_code_counts");
    if (c) setCounts(c);
  }, []);

  const me = useMe();
  const { unread } = useInbox(me?.id, (n) => {
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
          <Link to="/inbox" aria-label={unread ? `Inbox, ${unread} new` : "Inbox"} className="relative flex size-11 items-center justify-center rounded-full text-deep-foreground/90 hover:bg-deep-mid">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold leading-5 text-deep-dark">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <Link
            to="/login"
            onClick={async (e) => {
              e.preventDefault();
              await supabase.auth.signOut();
              nav("/login");
            }}
            aria-label="Log out"
            className="flex size-11 items-center justify-center rounded-full text-deep-foreground/80 hover:bg-deep-mid"
          >
            <LogOut className="size-5" />
          </Link>
          </div>
        </div>
        <p className="mt-8 text-base leading-snug text-deep-foreground/80">Assalam Alaekum Waramotullahi Wabarakatu.</p>
        <h1 className="mt-1 text-4xl font-semibold">{firstName}</h1>
        <span className="mt-3 inline-flex rounded-full bg-gold px-3.5 py-1.5 text-sm font-bold text-deep-dark">House {profile.house_number} · {unitLabel}</span>
      </Hero>
      <Sheet className="space-y-7">
        <Link to="/create-code" className={btnClass("gold", "min-h-16 text-lg")}><span className="flex size-8 items-center justify-center rounded-full bg-deep text-gold"><Plus className="size-5" /></span> Create access code</Link>

        <AlertsCard userId={me?.id} />

        {banner && (
          <div className="flex items-center gap-3 rounded-lg bg-mint-lightest p-3 pl-4">
            <p className="flex-1 text-sm text-text-2">Add Lighthouse Lekki to your Home Screen for quick access</p>
            <button onClick={async () => { if (!(await promptInstall())) setHow(true); }} className="min-h-11 rounded-sm bg-card px-4 text-sm font-semibold text-deep">How</button>
            <button onClick={() => setBanner(false)} aria-label="Dismiss" className="flex size-11 items-center justify-center text-muted-foreground"><X className="size-4" /></button>
          </div>
        )}

        <section className="deep-card relative overflow-hidden rounded-lg p-6">
          <span aria-hidden className="pointer-events-none absolute -top-3 right-4 font-display text-9xl font-extrabold leading-none text-gold/25">”</span>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Daily hadith</p>
          <p className="relative mt-3 font-display text-xl font-medium leading-snug text-white">“{h.text}”</p>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <p className="text-xs leading-6 text-gold/90">{HADITH_ATTRIBUTION}</p>
            <Link to="/hadith" className="shrink-0 py-2 text-sm font-bold text-primary">More hadith</Link>
          </div>
        </section>

        {recentVisitors.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Recent visitors</h2>
            <div className="scrollbar-hidden -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {recentVisitors.map((n) => (
                <button
                  key={n}
                  onClick={() => nav("/create-code", { state: { holderName: n } })}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-4 text-sm font-medium"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-mint-light font-display font-semibold text-deep">{n[0]}</span>{n}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">My codes</h2>
            {counts && counts.total > 0 && <Link to="/codes" className="inline-flex min-h-11 items-center text-sm font-bold text-primary">See all</Link>}
          </div>
          {counts && counts.total > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {([["Active", counts.active, "bg-mint-light text-deep"], ["Used", counts.used, "bg-muted text-text-2"], ["Total", counts.total, "bg-gold-light text-gold-text"]] as const).map(([l, n, c]) => (
                <Link key={l} to="/codes" state={{ status: l === "Total" ? "All" : l }} className={`rounded-lg px-3 py-2.5 ${c}`}>
                  <span className="block font-display text-2xl font-bold">{n}</span>
                  <span className="block text-xs font-semibold">{l}</span>
                </Link>
              ))}
            </div>
          )}
          {codes.length === 0 ? (
            <p className="rounded-lg bg-muted p-6 text-center text-text-2">No codes yet.</p>
          ) : (
            <ul className="space-y-3">
              {codes.map((c) => {
                const status = getCodeStatus(c, now);
                return (
                  <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`code-digits text-3xl font-bold ${status === "Active" ? "text-deep" : "text-muted-foreground"}`}>{formatCode(c.code)}</p>
                      <StatusChip status={status} />
                    </div>
                    <p className="mt-1 font-medium">{c.holder_name}{c.type === "long_stay" && <span className="ml-2 rounded-full bg-gold-light px-2 py-0.5 align-middle text-xs font-bold text-gold-text">Long stay</span>}</p>
                    <p className="text-sm text-muted-foreground">{formatValidity(c, now)}</p>
                    <div className="mt-3 flex gap-2">
                      {status === "Active" ? (
                        <>
                          <button
                            aria-label="Share"
                            onClick={() =>
                              shareAccessCode({
                                code: c.code,
                                validTo: c.valid_to,
                                houseNumber: profile.house_number,
                                unitLabel,
                                type: c.type,
                                validFrom: c.valid_from,
                              })
                            }
                            className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"
                          >
                            <Share2 className="size-5" />
                          </button>
                          <button
                            onClick={() => {
                              setExtendTarget(c);
                              setExtendOption("Tomorrow");
                              setExtendPicked("");
                              setExtendError("");
                              setExtending(false);
                            }}
                            className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold"
                          >
                            Extend
                          </button>
                          <button
                            onClick={() => {
                              setCancelTarget(c);
                              setCancelError("");
                              setCancelling(false);
                            }}
                            className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold text-destructive"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <Link
                          to="/create-code"
                          state={{ holderName: c.holder_name }}
                          className="flex min-h-11 flex-1 items-center justify-center rounded-sm border border-border text-sm font-semibold text-deep"
                        >
                          Create again
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Sheet>
      <BottomSheet open={how} onClose={() => setHow(false)} title="Add to Home Screen">
        <div className="space-y-3 pb-4 text-base text-text-2">
          <p>iPhone: tap the Share icon, then Add to Home Screen.</p>
          <p>Android: tap the menu (three dots), then Add to Home screen.</p>
        </div>
      </BottomSheet>
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
    </Screen>
  );
}

export default Home;
