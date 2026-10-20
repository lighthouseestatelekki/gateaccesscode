import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { dailyHadith, HADITH_ATTRIBUTION, hadith } from "@/mock/hadith";

/** Today's hadith card (used inside the swipeable Today card on Home). */
export function HadithSlide() {
  const [h, setH] = useState(hadith[0]!);
  useEffect(() => setH(dailyHadith()!), []);
  return (
    <section aria-label="Daily hadith" className="deep-card relative flex h-full flex-col overflow-hidden rounded-[22px] p-5">
      <span aria-hidden className="pointer-events-none absolute -top-3 right-4 font-display text-9xl font-extrabold leading-none text-gold/25">”</span>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Daily hadith</p>
      <p className="relative mt-3 font-display text-xl font-medium leading-snug text-white">“{h.text}”</p>
      <div className="relative mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="text-xs leading-6 text-gold/90">{HADITH_ATTRIBUTION}</p>
        <Link to="/hadith" className="shrink-0 py-2 text-sm font-bold text-primary">More hadith</Link>
      </div>
    </section>
  );
}
