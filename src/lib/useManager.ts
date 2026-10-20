import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCached, setCached } from "@/lib/profileCache";
import { signedOutElsewhere } from "@/lib/sessionCheck";
import { mfaState } from "@/lib/mfa";

export type ManagerProfile = { id: string; role: string; status: string; full_name: string; must_change_pin?: boolean | null };

/** Loads the signed-in Estate Manager. Anyone else is signed out and sent to /manager/login. */
export function useManager(): ManagerProfile | null {
  const nav = useNavigate();
  const [profile, setProfile] = useState<ManagerProfile | null>(() => getCached("manager"));
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const user = s?.session?.user;
      if (!user) {
        if (alive) nav("/manager/login", { replace: true });
        return;
      }
      const { data, error } = await supabase.from("profiles").select("id,role,status,full_name,must_change_pin").eq("id", user.id).single();
      if (!alive) return;
      if (error || !data || data.role !== "estate_manager" || data.status !== "active") {
        await supabase.auth.signOut();
        nav("/manager/login", { replace: true });
        return;
      }
      // New or reset Estate Manager: choose their own password first.
      if (data.must_change_pin) {
        nav("/manager/login", { replace: true });
        return;
      }
      // Signed in with the password only: finish the authenticator step first.
      if ((await mfaState()) !== "verified") {
        if (alive) nav("/manager/login", { replace: true });
        return;
      }
      setCached("manager", data);
      // Signed out of every device by the Estate Manager? Leave now.
      signedOutElsewhere().then((out) => out && nav("/manager/login", { replace: true }));
      setProfile(data as ManagerProfile);
    })();
    return () => {
      alive = false;
    };
  }, [nav]);
  return profile;
}
