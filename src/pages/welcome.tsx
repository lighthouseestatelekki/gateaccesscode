import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BellRing, KeyRound, ShieldCheck } from "lucide-react";
import { btnClass } from "@/components/lh/ui";
import { getStaffChoice, homeForSession, staffPath } from "@/lib/entry";
import { cn } from "@/lib/utils";

export const title = "Welcome";

const CARDS = [
  { icon: KeyRound, title: "Invite visitors in seconds", text: "Create a gate code and share it on WhatsApp. Your visitor just shows it at the gate." },
  { icon: ShieldCheck, title: "Quick, safe entry at the gate", text: "Security checks every code. You know who came in, and when." },
  { icon: BellRing, title: "Help when you need it", text: "One tap SOS alerts security. Estate announcements reach you straight away." },
] as const;

function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden className="text-gold">
      <path d="M10 24h6l-1.2-13h-3.6z" fill="currentColor" />
      <rect x="9.5" y="6" width="7" height="4" rx="1" fill="currentColor" />
      <path d="M13 2l3 4h-6z" fill="currentColor" />
      <path d="M18 7.5l6-2.5M18 8.5l6 2.5M8 7.5L2 5M8 8.5L2 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/** The front door. Signed in → straight to your home. Signed out → logo, then 3 welcome cards. */
function Welcome() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [i, setI] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const minSplash = new Promise((r) => setTimeout(r, 700));
    (async () => {
      const home = await homeForSession().catch(() => null);
      if (!alive) return;
      if (home) return nav(home, { replace: true });
      const staff = getStaffChoice();
      if (staff) return nav(staffPath(staff), { replace: true });
      await minSplash;
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [nav]);

  function go(n: number) {
    const el = strip.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="hero mx-auto flex min-h-dvh w-full max-w-md flex-col text-white">
      {!ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4" aria-busy="true">
          <div className="animate-pulse"><Logo size={72} /></div>
          <p className="font-display text-2xl font-bold tracking-tight">Lighthouse Lekki</p>
          <p className="text-sm text-white/70">Assalam Alaekum</p>
        </div>
      ) : (
        <>
          <header className="flex items-center gap-2 px-5 pt-6 safe-top">
            <Logo size={26} />
            <span className="font-display text-lg font-semibold tracking-tight">Lighthouse Lekki</span>
          </header>
          <h1 className="sr-only">Welcome to Lighthouse Lekki</h1>
          <div
            ref={strip}
            onScroll={(e) => {
              const el = e.currentTarget;
              setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
            className="scrollbar-hidden flex flex-1 snap-x snap-mandatory overflow-x-auto"
          >
            {CARDS.map((c, n) => {
              const Icon = c.icon;
              return (
                <section key={c.title} aria-label={`${n + 1} of ${CARDS.length}`} className="flex w-full shrink-0 snap-center flex-col justify-center px-7">
                  <div className="relative mb-9 flex size-32 items-center justify-center rounded-[2.5rem] bg-white/12 ring-1 ring-white/20">
                    <span className="absolute -right-2 -top-2 size-7 rounded-full bg-gold/90" aria-hidden />
                    <Icon className="size-14 text-gold" strokeWidth={1.8} />
                  </div>
                  <h2 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight">{c.title}</h2>
                  <p className="mt-3 max-w-[22rem] text-lg leading-relaxed text-white/80">{c.text}</p>
                </section>
              );
            })}
          </div>
          <div className="px-5 safe-bottom">
            <div className="mb-6 flex justify-center gap-2">
              {CARDS.map((c, n) => (
                <button key={c.title} aria-label={`Show card ${n + 1}`} onClick={() => go(n)} className="flex size-6 items-center justify-center">
                  <span className={cn("h-2 rounded-full transition-all", n === i ? "w-6 bg-gold" : "w-2 bg-white/40")} />
                </button>
              ))}
            </div>
            <Link to="/login" className={btnClass("gold", "min-h-14 text-lg")}>Get started</Link>
            <p className="mt-3 text-center text-sm text-white/75">
              New resident? <Link to="/register" className="font-semibold text-white underline underline-offset-4">Register</Link>
            </p>
            <div className="mt-2 flex justify-center">
              <Link to="/guard/login" className="inline-flex min-h-11 items-center px-3 text-xs font-semibold text-white/60">Staff sign-in</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Welcome;
