import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Hero, meta, Screen, Sheet } from "@/components/lh/ui";
import { FILTERS, HADITH_ATTRIBUTION, hadith, matchesFilter, type Filter } from "@/mock/hadith";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hadith")({
  head: () => meta("Hadith", "Hadith on community, neighbours and living together."),
  component: HadithPage,
});

function HadithPage() {
  const [f, setF] = useState<Filter>("All");
  const list = hadith.filter((h) => matchesFilter(h, f));
  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Hadith</h1>
      </Hero>
      <Sheet className="space-y-5">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {FILTERS.map((x) => (
            <button key={x} onClick={() => setF(x)} className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", f === x ? "bg-deep text-deep-foreground" : "bg-muted text-text-2")}>{x}</button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="rounded-lg bg-muted p-6 text-center text-text-2">Nothing here yet.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((h) => (
              <li key={h.id} className="rounded-lg border border-border bg-card p-5">
                <p className="font-display text-lg leading-snug">“{h.text}”</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs leading-7 text-muted-foreground">{HADITH_ATTRIBUTION}</p>
                  <button aria-label="Share" className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-muted"><Share2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </Screen>
  );
}
