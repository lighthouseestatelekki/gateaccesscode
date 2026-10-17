import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export type ResidentProfile = {
  role: string;
  status: string;
  must_change_pin: boolean;
  full_name: string;
  house_number: string;
  house_unit: string;
};

export function useResident(): ResidentProfile | null {
  const nav = useNavigate();
  const [profile, setProfile] = useState<ResidentProfile | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        await supabase.auth.signOut();
        if (active) nav("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role,status,must_change_pin,full_name,house_number,house_unit")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (error || !data || data.role !== "resident" || data.status !== "active") {
        await supabase.auth.signOut();
        if (active) nav("/login", { replace: true });
        return;
      }

      setProfile(data as ResidentProfile);
    }
    load();
    return () => {
      active = false;
    };
  }, [nav]);

  return profile;
}
