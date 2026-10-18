import { supabase } from "@/lib/supabase";
import { deviceId, pinAuth } from "@/lib/staffAdmin";

// App lock: if the app hasn't been used for a while, ask for the PIN again before showing anything.
// This protects a phone that is left unlocked, borrowed or stolen. The PIN is checked on the server
// (same wrong-PIN limits as signing in).

export const LOCK_AFTER_MS = 4 * 60 * 60 * 1000; // 4 hours
const KEY = "lh.active";

export function markActive(at = Date.now()) {
  try {
    localStorage.setItem(KEY, String(at));
  } catch {
    /* storage blocked */
  }
}

export function lastActive(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Locked when there is no record of recent use, or the last use was too long ago. */
export function shouldLock(now = Date.now()): boolean {
  const last = lastActive();
  return last === null || now - last > LOCK_AFTER_MS;
}

function subOf(token: string): string {
  try {
    return (JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string }).sub ?? "";
  } catch {
    return "";
  }
}

/** Checks the PIN for THIS person. Someone else's PIN from the same house does not unlock. */
export async function unlockWithPin(p: { userId: string; house_number: string; house_unit: string; pin: string }): Promise<void> {
  const r = await pinAuth<{ access_token: string; refresh_token: string }>({
    action: "login", kind: "resident", house_number: p.house_number, house_unit: p.house_unit, pin: p.pin, device: deviceId(),
  });
  if (subOf(r.access_token) !== p.userId) throw new Error("That PIN belongs to someone else. Please enter your own PIN.");
  await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
  markActive();
}
