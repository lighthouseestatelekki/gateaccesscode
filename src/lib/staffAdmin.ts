import { supabase } from "@/lib/supabase";

/**
 * Calls the "pin-auth" Edge Function (all PIN actions and Estate Manager admin actions live there)
 * and returns its JSON, or throws an Error carrying the server's own message.
 */
export async function pinAuth<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pin-auth", { body });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) message = j.error;
      } catch {
        /* keep the original message */
      }
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data) throw new Error(String((data as { error: unknown }).error));
  return data as T;
}

/** Estate Manager actions (create_guard, reset_pin). */
export const staffAdmin = pinAuth;

type SignInResult = { data: { user: { id: string } | null }; error: { message: string } | null };

/**
 * PIN sign-in through the server (which enforces the wrong-PIN lock), then stores the session locally.
 * Returns the same shape as supabase.auth.signInWithPassword so screens handle it the same way.
 */
/** A random id this phone keeps, so wrong PINs lock only this phone (not the whole house). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("lh.device");
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem("lh.device", id);
    }
    return id;
  } catch {
    return "";
  }
}

export async function pinSignIn(params: { kind: "resident"; house_number: string; house_unit: string; pin: string } | { kind: "guard"; guard_number: string; pin: string }): Promise<SignInResult> {
  try {
    const r = await pinAuth<{ access_token: string; refresh_token: string }>({ action: "login", ...params, device: deviceId() });
    const { data, error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    if (error || !data.user) return { data: { user: null }, error: { message: error?.message ?? "Could not sign in." } };
    return { data: { user: { id: data.user.id } }, error: null };
  } catch (e) {
    return { data: { user: null }, error: { message: (e as Error).message } };
  }
}
