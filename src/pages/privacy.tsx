import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Hero, Screen, Sheet } from "@/components/lh/ui";
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from "@/lib/privacy";

export const title = "Privacy notice";

/** Public: anyone can read it before signing in. */
function Privacy() {
  const nav = useNavigate();
  return (
    <Screen>
      <Hero>
        <button aria-label="Back" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))} className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></button>
        <h1 className="mt-2 text-3xl font-semibold">Privacy notice</h1>
        <p className="mt-1 text-deep-foreground/75">How Light House Estate uses your information. Updated {PRIVACY_UPDATED}.</p>
      </Hero>
      <Sheet className="space-y-5 pb-10">
        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-bold">{s.title}</h2>
            {s.body.map((p, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed text-text-2">{p}</p>)}
          </section>
        ))}
      </Sheet>
    </Screen>
  );
}

export default Privacy;
