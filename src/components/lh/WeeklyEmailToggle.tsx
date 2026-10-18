import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

/** On/off switch for the Monday-morning summary email. Hidden until the database supports it. */
export function WeeklyEmailToggle() {
  const me = useMe();
  const id = me?.id;
  const [on, setOn] = useState<boolean | null>(null);
  const [hasEmail, setHasEmail] = useState(true);
  useEffect(() => {
    if (!id) return;
    supabase.from("profiles").select("weekly_email,email").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return;
      const d = data as { weekly_email: boolean; email: string | null };
      setOn(d.weekly_email);
      setHasEmail(!!d.email && /@/.test(d.email) && !/lighthouseestate\.app$/i.test(d.email));
    });
  }, [id]);
  if (on === null) return null;

  async function toggle() {
    const next = !on;
    setOn(next);
    const { error } = await supabase.rpc("set_weekly_email", { p_on: next });
    if (error) setOn(!next);
  }

  return (
    <button role="switch" aria-checked={on} onClick={toggle} className="flex min-h-16 w-full items-center gap-4 rounded-lg border border-border bg-card px-4 text-start">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-light text-deep"><Mail className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">Weekly summary email</span>
        <span className="block text-sm text-text-2">{hasEmail ? "Every Monday morning: visitors, codes and anything open." : "Add an email address to get this."}</span>
      </span>
      <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "start-[1.375rem]" : "start-0.5")} />
      </span>
    </button>
  );
}
