import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export type GuardProfile = {
  role: string;
  status: string;
  full_name: string;
  guard_number: number | string;
  assigned_gate: number | string;
};

export function useGuard(): GuardProfile | null {
  const nav = useNavigate();
  const [profile, setProfile] = useState<GuardProfile | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        await supabase.auth.signOut();
        if (active) nav("/guard/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role,status,full_name,guard_number,assigned_gate")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (error || !data || data.role !== "guard" || data.status !== "active") {
        await supabase.auth.signOut();
        if (active) nav("/guard/login", { replace: true });
        return;
      }

      setProfile(data as GuardProfile);
    }
    load();
    return () => {
      active = false;
    };
  }, [nav]);

  return profile;
}
