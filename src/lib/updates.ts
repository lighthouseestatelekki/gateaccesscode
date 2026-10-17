import { useEffect, useState } from "react";

const CURRENT = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

async function latestBuild(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { build?: string }).build ?? null;
  } catch {
    return null;
  }
}

/** True once a newer version of the app has been published. Checks on open, every 5 minutes, and when the app comes back to the screen. */
export function useUpdateReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (CURRENT === "dev" || !import.meta.env.PROD) return;
    let stop = false;
    const check = async () => {
      const b = await latestBuild();
      if (!stop && b && b !== CURRENT) setReady(true);
    };
    check();
    const t = setInterval(check, 5 * 60_000);
    const onShow = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return ready;
}
