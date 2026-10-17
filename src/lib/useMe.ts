import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCached, setCached } from "@/lib/profileCache";

export type Me = {
  id: string; role: "resident" | "guard" | "estate_manager"; status: string; full_name: string;
  phone: string | null; house_number: string | null; house_unit: string | null; guard_number: string | null;
};

/** Whoever is signed in right now (any role), or null. Follows sign-in / sign-out live. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(() => getCached("me"));
  useEffect(() => {
    let alive = true;
    async function load(userId: string | undefined) {
      if (!userId) {
        setCached("me", null);
        if (alive) setMe(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,role,status,full_name,phone,house_number,house_unit,guard_number")
        .eq("id", userId)
        .maybeSingle();
      const next = data && data.status === "active" ? (data as Me) : null;
      setCached("me", next);
      if (alive) setMe(next);
    }
    supabase.auth.getSession().then(({ data }) => load(data?.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load(session?.user?.id);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return me;
}
