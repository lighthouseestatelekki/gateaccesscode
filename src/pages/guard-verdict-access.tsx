import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Verdict } from "@/components/lh/guard";
import { codeToUnit } from "@/lib/units";

export const title = "Access";

type AccessVerdictState = {
  result?: string;
  direction?: string;
  reason?: string;
  type?: string;
  house?: string | number;
  unit?: string;
  holder?: string;
  job_title?: string | null;
  photo?: string | null;
  id_line?: string | null;
};

export default function Page() {
  const location = useLocation();
  const nav = useNavigate();
  const state = location.state as AccessVerdictState | null;

  useEffect(() => {
    if (!state) {
      nav("/guard/verify", { replace: true });
      return;
    }
    try {
      navigator.vibrate?.(200);
    } catch {
      // Ignore if vibration unsupported
    }
  }, [state, nav]);

  if (!state) return null;

  const direction = (state.direction ?? "in").toUpperCase();
  const unitLabel = codeToUnit(state.unit ?? "");
  const rawType = state.type ?? "guest";
  const typeLabel = ({ guest: "Guest", long_stay: "Long stay", employee: `Staff${state.job_title ? ` · ${state.job_title}` : ""}` } as Record<string, string>)[rawType.toLowerCase()] ?? rawType;

  return (
    <Verdict tone="access" title="ACCESS" seconds={state.photo ? 10 : 4} compact={!!state.photo}>
      {state.photo && <img src={state.photo} alt={`Photo of ${state.holder}`} className="mx-auto mb-2 size-44 rounded-3xl object-cover ring-4 ring-white/70" />}
      <p className="mx-auto w-fit rounded-lg bg-deep px-8 py-2 font-display text-5xl font-bold text-deep-foreground">{direction}</p>
      <p className="pt-4 text-3xl font-bold">{state.holder}</p>
      <p className="text-2xl font-semibold">House {state.house} · {unitLabel}</p>
      <p className="text-xl opacity-85">{typeLabel}</p>
      {state.photo && <p className="text-base font-semibold opacity-90">Check the face matches the photo</p>}
      {state.id_line && <p className="text-base opacity-85">ID: {state.id_line}</p>}
    </Verdict>
  );
}
