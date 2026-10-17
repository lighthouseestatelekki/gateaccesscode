import { createClient } from "@supabase/supabase-js";

// Public values: Supabase designs the project URL and publishable key to be shipped in the app.
// NEVER put the secret / service_role key or the database password in this file.
export const SUPABASE_URL = "https://tsqddeqbpupdnwaunwdq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YsEm50JwfyyJIkLhWtk14g_-yH-YQDa";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
