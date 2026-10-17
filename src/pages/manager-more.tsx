import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ChevronRight, LogOut, Megaphone } from "lucide-react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { ThemePicker } from "@/components/lh/ThemePicker";
import { useManager } from "@/lib/useManager";

export const title = "More";

const row = "flex min-h-16 w-full items-center gap-4 px-4 text-left text-base font-semibold";
const ico = "flex size-10 shrink-0 items-center justify-center rounded-full";

function ManagerMore() {
  const nav = useNavigate();
  const me = useManager();
  if (!me) return null;
  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">More</h1>
        <p className="mt-1 text-deep-foreground/75">Estate Manager</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          <li><Link to="/manager/announce" className={row}><span className={`${ico} bg-gold-light text-gold-text`}><Megaphone className="size-5" /></span><span className="flex-1">Announcements</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/manager/insights" className={row}><span className={`${ico} bg-mint-light text-deep`}><BarChart3 className="size-5" /></span><span className="flex-1">Insights</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
        </ul>
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
