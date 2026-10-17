import { supabase } from "@/lib/supabase";

/** Calls the "staff-admin" Edge Function and returns its JSON, or throws an Error with the server's message. */
export async function staffAdmin<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("staff-admin", { body });
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
