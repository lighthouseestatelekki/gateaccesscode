import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button, btnClass, HadithLine, Hero, Screen, Sheet } from "@/components/lh/ui";
import { formatCode, formatValidity, shareAccessCode } from "@/lib/expiry";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";

export const title = "Code created";

type CodeCreatedState = {
  code?: string;
  holder_name?: string;
  valid_to?: string;
  valid_from?: string;
  type?: string;
};

function CodeCreated() {
  const location = useLocation();
  const nav = useNavigate();
  const profile = useResident();
  const [copied, setCopied] = useState(false);

  const state = location.state as CodeCreatedState | null;
  const hasState = Boolean(state?.code && state?.holder_name && state?.valid_to);

  useEffect(() => {
    if (!hasState) {
      nav("/home", { replace: true });
    }
  }, [hasState, nav]);

  if (!hasState) return null;

  return (
    <Screen>
      <Hero className="pb-16 text-center">
        <p className="pt-6 text-sm font-semibold uppercase tracking-widest text-deep-foreground/60">Access code</p>
        <p className="code-digits mt-3 text-6xl font-bold text-gold">{formatCode(state!.code!)}</p>
        <p className="mt-4 text-lg font-semibold">{state!.holder_name}</p>
        <p className="text-sm text-deep-foreground/70">{formatValidity({ type: state!.type, valid_from: state!.valid_from, valid_to: state!.valid_to! })}</p>
        {state!.type === "long_stay" && <span className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">Long stay · come and go</span>}
      </Hero>
      <Sheet className="space-y-3">
        <div className="pb-3 text-center">
          <h1 className="text-2xl font-semibold">JazakAllahu Khairan.</h1>
          <p className="mt-1 text-text-2">Show this code to the guard at the gate.</p>
        </div>
        <Button
          onClick={() => {
            if (!profile) return;
            shareAccessCode({
              code: state!.code!,
              validTo: state!.valid_to!,
              houseNumber: profile.house_number,
              unitLabel: codeToUnit(profile.house_unit),
              type: state!.type,
              validFrom: state!.valid_from,
            });
          }}
        >
          <Share2 className="size-5" /> Share
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const digitsOnly = state!.code!.replace(/\s+/g, "");
            navigator.clipboard?.writeText(digitsOnly);
            setCopied(true);
          }}
        >
          <Copy className="size-5" /> {copied ? "Copied" : "Copy code"}
        </Button>
        <Link to="/home" className={btnClass("outline")}>Done</Link>
        <p className="text-center"><Link to="/create-code" className="inline-flex min-h-11 items-center font-semibold text-deep">Create another</Link></p>
        <HadithLine className="pt-4" />
      </Sheet>
    </Screen>
  );
}

export default CodeCreated;
