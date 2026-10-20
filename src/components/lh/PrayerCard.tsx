import { useEffect, useState } from "react";
import { MoonStar } from "lucide-react";
import { clock, hijriDate, nextPrayer, PRAYERS } from "@/lib/prayer";
import { cn } from "@/lib/utils";

function until(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h} hr ${m} min` : `in ${h} hr`;
}

/** Today's prayer times for Lekki, the next one counting down, and the Hijri date. */
export function PrayerCard() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const next = nextPrayer(now);
  const hijri = hijriDate(now);

  return (
    <section aria-label="Prayer times" className="deep-card h-full overflow-hidden rounded-[22px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Next prayer</p>
          <p className="mt-1 font-display text-2xl font-extrabold leading-tight text-white">
            {next.name} <span className="text-gold">{clock(next.at)}</span>
          </p>
          <p className="text-sm text-deep-foreground/80">{until(next.at.getTime() - now.getTime())}</p>
        </div>
        {hijri && (
          <p className="flex max-w-[45%] items-start gap-1.5 text-right text-xs font-semibold leading-snug text-deep-foreground/80">
            <MoonStar className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>{hijri}</span>
          </p>
        )}
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Today in Lekki">
        {PRAYERS.map((p) => {
          const on = p === next.name && next.at.getTime() === next.today.times[p].getTime();
          return (
            <li key={p} className={cn("rounded-xl px-1 py-2 text-center", on ? "bg-gold text-deep-dark" : "bg-white/10 text-deep-foreground")}>
              <span className="block text-[11px] font-bold">{p}</span>
              <span className="block text-xs font-semibold tabular-nums">{clock(next.today.times[p]).replace(" AM", "").replace(" PM", "")}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-deep-foreground/60">Times for Lekki. Your mosque's timetable may differ by a minute or two.</p>
    </section>
  );
}
