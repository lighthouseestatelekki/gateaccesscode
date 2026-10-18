import { supabase } from "@/lib/supabase";
import { clearCache } from "@/lib/profileCache";

/**
 * Has the Estate Manager (or the main resident) signed this person out of every device?
 * Runs quietly in the background on each screen. If the sign-in was cut off, sign out here too.
 * Returns true when it signed out.
 */
export async function signedOutElsewhere(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("session_ok");
    if (error || data !== false) return false; // older database without the check, or still fine
    clearCache();
    await supabase.auth.signOut({ scope: "local" });
    return true;
  } catch {
    return false;
  }
}
