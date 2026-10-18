import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ChevronRight, DoorOpen, History, LogOut, Megaphone, TriangleAlert, Truck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { ThemePicker } from "@/components/lh/ThemePicker";
import { WeeklyEmailToggle } from "@/components/lh/WeeklyEmailToggle";
import { useManager } from "@/lib/useManager";

export const title = "More";

const row = "flex min-h-16 w-full items-center gap-4 px-4 text-left text-base font-semibold";
const ico = "flex size-10 shrink-0 items-center justify-center rounded-full";

function ManagerMore() {
  const nav = useNavigate();
  const me = useManager();
  const [openFixit, setOpenFixit] = useState<number | null>(null);
  const [openIncidents, setOpenIncidents] = useState<number | null>(null);
  const [moves, setMoves] = useState<number | null>(null);
  useEffect(() => {
    if (!me) return;
    supabase.from("fixit_requests").select("id", { count: "exact", head: true }).neq("status", "done").then(({ count }) => setOpenFixit(count ?? 0));
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "open").then(({ count }) => setOpenIncidents(count ?? 0));
    supabase.from("move_outs").select("id", { count: "exact", head: true }).eq("status", "requested").then(({ count }) => setMoves(count ?? 0));
  }, [me]);
  if (!me) return null;
  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">More</h1>
        <p className="mt-1 text-deep-foreground/75">Estate Manager</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          <li><Link to="/manager/incidents" className={row}><span className={`${ico} bg-destructive-light text-destructive`}><TriangleAlert className="size-5" /></span><span className="flex-1">Incidents</span>{!!openIncidents && <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold text-destructive-foreground">{openIncidents} open</span>}<ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/inside" className={row}><span className={`${ico} bg-mint-light text-deep`}><DoorOpen className="size-5" /></span><span className="flex-1">Inside now</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/fixit" className={row}><span className={`${ico} bg-mint-light text-deep`}><Wrench className="size-5" /></span><span className="flex-1">Fix-It requests</span>{!!openFixit && <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-deep-dark">{openFixit} open</span>}<ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/announce" className={row}><span className={`${ico} bg-gold-light text-gold-text`}><Megaphone className="size-5" /></span><span className="flex-1">Announcements</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/moving" className={row}><span className={`${ico} bg-mint-light text-deep`}><Truck className="size-5" /></span><span className="flex-1">Moving out</span>{!!moves && <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-deep-dark">{moves} to confirm</span>}<ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/history" className={row}><span className={`${ico} bg-mint-light text-deep`}><History className="size-5" /></span><span className="flex-1">Action history</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/insights" className={row}><span className={`${ico} bg-mint-light text-deep`}><BarChart3 className="size-5" /></span><span className="flex-1">Insights</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
        </ul>
        <WeeklyEmailToggle />
        <ThemePicker />
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            nav("/manager/login", { replace: true });
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card font-semibold text-destructive"
        >
          <LogOut className="size-5" /> Sign out
        </button>
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default ManagerMore;
