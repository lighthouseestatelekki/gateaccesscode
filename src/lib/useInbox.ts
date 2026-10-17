import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Notice = {
  id: string; kind: string; title: string; body: string | null; link: string | null;
  sos_id: string | null; created_at: string; read_at: string | null;
};

/**
 * The signed-in person's inbox, kept live: new notices appear without refreshing.
 * `onNew` runs for every notice that arrives while the screen is open.
 */
export function useInbox(userId: string | null | undefined, onNew?: (n: Notice) => void) {
  const [items, setItems] = useState<Notice[] | null>(null);
  const cb = useRef(onNew);
  cb.current = onNew;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,kind,title,body,link,sos_id,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notice[]);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const ch = supabase
      .channel(`inbox-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, (p) => {
        const n = p.new as Notice;
        setItems((prev) => [n, ...(prev ?? []).filter((x) => x.id !== n.id)]);
        cb.current?.(n);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const markAllRead = useCallback(async () => {
    await supabase.rpc("mark_notifications_read", { p_ids: null });
    const now = new Date().toISOString();
    setItems((prev) => (prev ?? []).map((x) => (x.read_at ? x : { ...x, read_at: now })));
  }, []);

  const unread = (items ?? []).filter((x) => !x.read_at).length;
  return { items, unread, reload: load, markAllRead };
}
