import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Plus, Share2, X } from "lucide-react";
import { BottomSheet, btnClass, Hero, meta, Screen, Sheet, StatusChip, Wordmark } from "@/components/lh/ui";
import { codes, recentVisitors, resident } from "@/mock/data";
import { dailyHadith, HADITH_ATTRIBUTION, hadith } from "@/mock/hadith";

export const Route = createFileRoute("/home")({
  head: () => meta("Home", "Create and manage visitor access codes."),
  component: Home,
});

function Home() {
  const nav = useNavigate();
  const [banner, setBanner] = useState(true);
  const [how, setHow] = useState(false);
  const [h, setH] = useState(hadith[0]!);
  useEffect(() => setH(dailyHadith()!), []);

  return (
    <Screen>
      <Hero className="pb-14">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link to="/login" aria-label="Log out" className="-mr-2 flex size-11 items-center justify-center rounded-full text-deep-foreground/80 hover:bg-deep-mid"><LogOut className="size-5" /></Link>
        </div>
        <p className="mt-8 text-base leading-snug text-deep-foreground/80">Assalam Alaekum Waramotullahi Wabarakatu.</p>
        <h1 className="mt-1 text-4xl font-semibold">{resident.firstName}</h1>
        <p className="mt-1 text-sm text-deep-foreground/60">House {resident.house} · {resident.unit}</p>
      </Hero>
      <Sheet className="space-y-7">
        <Link to="/create-code" className={btnClass("primary", "min-h-16 text-lg")}><Plus className="size-6" /> Create access code</Link>

        {banner && (
          <div className="flex items-center gap-3 rounded-lg bg-mint-lightest p-3 pl-4">
            <p className="flex-1 text-sm text-text-2">Add Lighthouse Lekki to your Home Screen for quick access</p>
            <button onClick={() => setHow(true)} className="min-h-11 rounded-sm bg-card px-4 text-sm font-semibold text-deep">How</button>
            <button onClick={() => setBanner(false)} aria-label="Dismiss" className="flex size-11 items-center justify-center text-muted-foreground"><X className="size-4" /></button>
          </div>
        )}

        <section className="rounded-lg border border-gold/40 bg-gold-light/50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">Daily hadith</p>
          <p className="mt-2 font-display text-lg leading-snug text-foreground">“{h.text}”</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-xs leading-7 text-text-2">{HADITH_ATTRIBUTION}</p>
            <Link to="/hadith" className="shrink-0 py-2 text-sm font-semibold text-gold-text">More hadith</Link>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent visitors</h2>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {recentVisitors.slice(0, 4).map((n) => (
              <button key={n} onClick={() => nav({ to: "/create-code" })} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-4 text-sm font-medium">
                <span className="flex size-9 items-center justify-center rounded-full bg-mint-light font-display font-semibold text-deep">{n[0]}</span>{n}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">My codes</h2>
          {codes.length === 0 ? (
            <p className="rounded-lg bg-muted p-6 text-center text-text-2">No codes yet.</p>
          ) : (
            <ul className="space-y-3">
              {codes.map((c) => (
                <li key={c.code} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`code-digits text-2xl font-bold ${c.status === "Active" ? "text-deep" : "text-muted-foreground"}`}>{c.code}</p>
                    <StatusChip status={c.status} />
                  </div>
                  <p className="mt-1 font-medium">{c.visitor}</p>
                  <p className="text-sm text-muted-foreground">Until {c.expiry}</p>
                  <div className="mt-3 flex gap-2">
                    {c.status === "Active" ? (
                      <>
                        <button aria-label="Share" className="flex size-11 items-center justify-center rounded-sm bg-mint-light text-deep"><Share2 className="size-5" /></button>
                        <button className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold">Extend</button>
                        <button className="min-h-11 flex-1 rounded-sm border border-border text-sm font-semibold text-destructive">Cancel</button>
                      </>
                    ) : (
                      <Link to="/create-code" className="flex min-h-11 flex-1 items-center justify-center rounded-sm border border-border text-sm font-semibold text-deep">Create again</Link>
                    )}
                  </div>
                </li>
              ))}
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
