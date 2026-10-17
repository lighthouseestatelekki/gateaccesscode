import { supabase } from "@/lib/supabase";

/** Which staff sign-in this phone used last ("guard" on the gate phone). Empty for residents. */
export type StaffKind = "guard" | "manager";
const STAFF_KEY = "lh.staff";

export function getStaffChoice(): StaffKind | null {
  try {
    const v = localStorage.getItem(STAFF_KEY);
    return v === "guard" || v === "manager" ? v : null;
  } catch {
    return null;
  }
}
export function setStaffChoice(v: StaffKind | null) {
  try {
    if (v) localStorage.setItem(STAFF_KEY, v);
    else localStorage.removeItem(STAFF_KEY);
  } catch {
    /* storage blocked: the phone just won't remember */
  }
}
export const staffPath = (k: StaffKind) => (k === "guard" ? "/guard/login" : "/manager/login");

/** Where a signed-in person belongs, or null if nobody (usable) is signed in. */
export async function homeForSession(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role,status,must_change_pin").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "active") return null;
  if (p.role === "guard") return "/guard/verify";
  if (p.role === "estate_manager") return "/manager/approvals";
  if (p.role === "resident") return p.must_change_pin ? "/change-pin" : "/home";
  return null;
}
