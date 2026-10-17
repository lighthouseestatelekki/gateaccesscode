import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Verdict } from "@/components/lh/guard";

export const title = "Expired";

type ExpiredVerdictState = {
  reason?: string;
};

export default function Page() {
  const location = useLocation();
  const nav = useNavigate();
  const state = location.state as ExpiredVerdictState | null;

  useEffect(() => {
    if (!state) {
      nav("/guard/verify", { replace: true });
      return;
    }
    try {
      navigator.vibrate?.([150, 100, 150]);
    } catch {
      // Ignore if vibration unsupported
    }
  }, [state, nav]);

  if (!state) return null;

  return (
    <Verdict tone="expired" title="EXPIRED">
      <p className="text-2xl font-semibold">{state.reason}</p>
    </Verdict>
  );
}
