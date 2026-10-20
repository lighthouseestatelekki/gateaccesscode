import { Link } from "react-router-dom";
import { BarChart3, BookOpen, GraduationCap, LayoutGrid, ShieldCheck, Truck, UsersRound, Wrench } from "lucide-react";

const TILES = [
  { to: "/household", icon: UsersRound, label: "Household" },
  { to: "/fixit", icon: Wrench, label: "Fix-It" },
  { to: "/insights", icon: BarChart3, label: "Insights" },
  { to: "/hadith", icon: BookOpen, label: "Hadith" },
  { href: "https://lighthouse-madrasa.pages.dev", icon: GraduationCap, label: "Madrasa" },
  { to: "/moving", icon: Truck, label: "Moving out" },
  { to: "/privacy", icon: ShieldCheck, label: "Privacy" },
  { to: "/more", icon: LayoutGrid, label: "All features" },
] as const;

/** "Explore the app": shortcuts to the features that live under More. */
export function ExploreGrid() {
  const cls = "flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-mint-lightest px-1 py-2 text-center text-xs font-semibold text-deep";
  return (
    <section aria-label="Explore the app">
      <h2 className="mb-3 text-lg font-bold">Explore the app</h2>
      <div className="grid grid-cols-4 gap-2">
        {TILES.map((t) => {
          const inner = (
            <>
              <span className="flex size-10 items-center justify-center rounded-full bg-card text-primary shadow-[0_4px_10px_-6px_var(--deep)]"><t.icon className="size-5" /></span>
              <span className="leading-tight">{t.label}</span>
            </>
          );
          return "href" in t
            ? <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            : <Link key={t.label} to={t.to} className={cls}>{inner}</Link>;
        })}
      </div>
    </section>
  );
}
