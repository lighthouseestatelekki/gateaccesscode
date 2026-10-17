import { supabase } from "@/lib/supabase";

// Remembers who is signed in for the rest of this visit, so moving between screens
// draws the new screen straight away instead of going blank while the server is asked again.
// Every screen still re-checks in the background; sign-out forgets everything.
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | null {
  return (store.get(key) as T | undefined) ?? null;
}
export function setCached<T>(key: string, value: T | null) {
  if (value === null) store.delete(key);
  else store.set(key, value);
}
export function clearCache() {
  store.clear();
}

try {
  supabase.auth.onAuthStateChange?.((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN") clearCache();
  });
} catch {
  /* tests may mock supabase without auth events */
}
