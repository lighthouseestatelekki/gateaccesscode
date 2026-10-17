import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Sos = {
  id: string; raised_by: string; full_name: string; phone: string | null; house_number: string; house_unit: string;
  status: "active" | "acknowledged" | "resolved" | "false_alarm"; created_at: string;
  acknowledged_by_name: string | null; acknowledged_at: string | null;
};

/** Open SOS alerts (active or acknowledged, last 24 hours), kept live. */
export function useOpenSos(enabled: boolean) {
  const [list, setList] = useState<Sos[]>([]);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await supabase
      .from("sos_alerts")
      .select("id,raised_by,full_name,phone,house_number,house_unit,status,created_at,acknowledged_by_name,acknowledged_at")
      .in("status", ["active", "acknowledged"])
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    setList((data ?? []) as Sos[]);
  }, []);
  useEffect(() => {
    if (!enabled) {
      setList([]);
      return;
    }
    load();
    const ch = supabase
      .channel(`sos-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, () => load())
      .subscribe();
    // safety net in case a live update is missed (weak network)
    const t = setInterval(load, 20_000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [enabled, load]);
  return { list, reload: load };
}

/** A loud repeating beep + vibration. Returns a stop function. Fails silently if the phone blocks sound. */
export function startAlarm(): () => void {
  let stopped = false;
  let ctx: AudioContext | null = null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  const beep = () => {
    if (stopped) return;
    try {
      if (ctx) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.35);
      }
      navigator.vibrate?.([300, 150, 300]);
    } catch {
      /* ignore */
    }
  };
  beep();
  const t = setInterval(beep, 1200);
  return () => {
    stopped = true;
    clearInterval(t);
    try {
      navigator.vibrate?.(0);
      ctx?.close();
    } catch {
      /* ignore */
    }
  };
}
