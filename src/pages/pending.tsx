import { Check, Clock } from "lucide-react";
import { useState } from "react";
import { BottomSheet, HadithLine, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";
import { isInstalled, promptInstall } from "@/lib/install";
import { cn } from "@/lib/utils";

export const title = "Registration received";

const STEPS = [
  { t: "Opened the app", done: true },
  { t: "Registered your house", done: true },
  { t: "Estate Manager review", d: "Usually within 24 hours", now: true },
  { t: "Invite your first visitor", d: "We'll alert you when you're approved" },
];

/** After registering: show how close they are, and give them something useful while they wait. */
function Pending() {
  const [how, setHow] = useState(false);
  return (
    <Screen>
      <Hero className="pb-16">
        <Wordmark />
        <h1 className="mt-8 text-3xl font-semibold">JazakAllahu Khairan.</h1>
        <p className="mt-1 text-deep-foreground/80">Under review by the Estate Manager, usually within 24 hours.</p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/25" aria-hidden="true">
            <div className="h-full w-3/4 rounded-full bg-gold" />
          </div>
          <span className="font-bold text-gold">75%</span>
        </div>
      </Hero>
      <Sheet className="flex flex-col gap-5">
        <ol className="space-y-1" aria-label="Your progress">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("flex size-9 items-center justify-center rounded-full", s.done ? "bg-primary text-primary-foreground" : s.now ? "bg-gold-light text-gold-text ring-2 ring-gold" : "bg-muted text-muted-foreground")}>
                  {s.done ? <Check className="size-5" /> : s.now ? <Clock className="size-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                </span>
                {i < STEPS.length - 1 && <span className={cn("my-1 h-6 w-0.5", s.done ? "bg-primary" : "bg-border")} />}
              </div>
              <div className="pt-1.5">
                <p className={cn("font-semibold", !s.done && !s.now && "text-text-2")}>{s.t}</p>
                {s.d && <p className="text-sm text-muted-foreground">{s.d}</p>}
              </div>
            </li>
          ))}
        </ol>
        {!isInstalled() && (
          <div className="flex items-center gap-3 rounded-2xl bg-mint-lightest p-4">
            <p className="flex-1 text-sm text-text-2">While you wait: install the app so it's one tap away when you're approved.</p>
            <button onClick={async () => { if (!(await promptInstall())) setHow(true); }} className="min-h-11 shrink-0 rounded-sm bg-card px-4 text-sm font-semibold text-deep">Install</button>
          </div>
        )}
        <HadithLine className="mt-auto pt-4" />
      </Sheet>
      <BottomSheet open={how} onClose={() => setHow(false)} title="Install App">
        <div className="space-y-3 pb-4 text-base text-text-2">
          <p>iPhone: tap the Share icon, then Add to Home Screen.</p>
          <p>Android: tap the menu (three dots), then Add to Home screen.</p>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Pending;
