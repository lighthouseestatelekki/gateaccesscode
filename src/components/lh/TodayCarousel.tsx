import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrayerCard } from "@/components/lh/PrayerCard";
import { HadithSlide } from "@/components/lh/HadithSlide";
import { cn } from "@/lib/utils";

const KEY = "lh.todaySlide";

/** Next prayer and daily hadith in one card: swipe (or tap the dots) to switch. */
export function TodayCarousel() {
  const slides: { name: string; el: ReactNode }[] = [
    { name: "Prayer times", el: <PrayerCard /> },
    { name: "Daily hadith", el: <HadithSlide /> },
  ];
  const strip = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(() => {
    try {
      return Number(localStorage.getItem(KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const GAP = 12;
  function go(n: number, smooth = true) {
    const el = strip.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const target = el?.children[n] as HTMLElement | undefined;
    if (!el || !first || !target) return;
    el.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }
  // open on the slide the person looked at last (after the page has laid out)
  useEffect(() => {
    if (!i) return;
    const t = setTimeout(() => go(i, false), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section aria-label="Today" aria-roledescription="carousel">
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth + GAP));
          if (n !== i) {
            setI(n);
            try {
              localStorage.setItem(KEY, String(n));
            } catch {
              /* ignore */
            }
          }
        }}
        className="scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto"
      >
        {slides.map((s, n) => (
          <div key={s.name} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}: ${s.name}`} className="w-full shrink-0 snap-start">
            {s.el}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {slides.map((s, n) => (
          <button key={s.name} aria-label={`Show ${s.name}`} aria-current={n === i} onClick={() => go(n)} className="flex size-7 items-center justify-center">
            <span className={cn("h-2 rounded-full transition-all", n === i ? "w-6 bg-primary" : "w-2 bg-border")} />
          </button>
        ))}
      </div>
    </section>
  );
}
