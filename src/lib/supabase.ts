import { createClient } from "@supabase/supabase-js";

// Public values: Supabase designs the project URL and publishable key to be shipped in the app.
// NEVER put the secret / service_role key or the database password in this file.
export const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || "https://tsqddeqbpupdnwaunwdq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  "sb_publishable_YsEm50JwfyyJIkLhWtk14g_-yH-YQDa";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
