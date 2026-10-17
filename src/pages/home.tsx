import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, Plus, Share2, X } from "lucide-react";
import { BottomSheet, btnClass, Hero, Screen, Sheet, StatusChip, Wordmark } from "@/components/lh/ui";
import { formatCode, formatUntil, shareAccessCode } from "@/lib/expiry";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";
import { dailyHadith, HADITH_ATTRIBUTION, hadith } from "@/mock/hadith";

export const title = "Home";

type AccessCodeRow = {
  id: string;
  code: string;
  holder_name: string;
  valid_to: string;
  active: boolean;
  used_at: string | null;
  created_at: string;
};

function getCodeStatus(c: AccessCodeRow, now: Date): "Active" | "Used" | "Expired" {
  if (c.used_at) return "Used";
  if (c.active && new Date(c.valid_to).getTime() > now.getTime()) return "Active";
  return "Expired";
}

function Home() {
  const nav = useNavigate();
  const profile = useResident();
  const [banner, setBanner] = useState(true);
  const [how, setHow] = useState(false);
  const [h, setH] = useState(hadith[0]!);
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);

  useEffect(() => setH(dailyHadith()!), []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    supabase
      .from("access_codes")
      .select("id,code,holder_name,valid_to,active,used_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (active && data) setCodes(data as AccessCodeRow[]);
      });
    return () => {
      active = false;
    };
  }, [profile]);

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

  return (
    <Screen>
      <Hero className="pb-14">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link
            to="/login"
            onClick={async (e) => {
              e.preventDefault();
              await supabase.auth.signOut();
              nav("/login");
            }}
            aria-label="Log out"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-deep-foreground/80 hover:bg-deep-mid"
          >
            <LogOut className="size-5" />
          </Link>
        </div>
        <p className="mt-8 text-base leading-snug text-deep-foreground/80">Assalam Alaekum Waramotullahi Wabarakatu.</p>
        <h1 className="mt-1 text-4xl font-semibold">{firstName}</h1>
        <span className="mt-3 inline-flex rounded-full bg-gold px-3.5 py-1.5 text-sm font-bold text-deep-dark">House {profile.house_number} · {unitLabel}</span>
      </Hero>
      <Sheet className="space-y-7">
        <Link to="/create-code" className={btnClass("gold", "min-h-16 text-lg")}><span className="flex size-8 items-center justify-center rounded-full bg-deep text-gold"><Plus className="size-5" /></span> Create access code</Link>

        {banner && (
          <div className="flex items-center gap-3 rounded-lg bg-mint-lightest p-3 pl-4">
            <p className="flex-1 text-sm text-text-2">Add Lighthouse Lekki to your Home Screen for quick access</p>
            <button onClick={() => setHow(true)} className="min-h-11 rounded-sm bg-card px-4 text-sm font-semibold text-deep">How</button>
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
          <h2 className="mb-3 text-lg font-semibold">My codes</h2>
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
                    <p className="mt-1 font-medium">{c.holder_name}</p>
                    <p className="text-sm text-muted-foreground">{formatUntil(c.valid_to, now)}</p>
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
                              })
                            }
                            className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"
                          >
                            <Share2 className="size-5" />
                          </button>
                          <button className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold">Extend</button>
                          <button className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold text-destructive">Cancel</button>
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
    </Screen>
  );
}

export default Home;
