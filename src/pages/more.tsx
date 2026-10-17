import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BarChart3, BookOpen, ChevronRight, KeyRound, LogOut, ShieldAlert, Smartphone } from "lucide-react";
import { BottomSheet, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ResidentTabs } from "@/components/lh/nav";
import { isInstalled, promptInstall } from "@/lib/install";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";

export const title = "More";

const row = "flex min-h-16 w-full items-center gap-4 px-4 text-left text-base font-semibold";
const ico = "flex size-10 shrink-0 items-center justify-center rounded-full";

function More() {
  const nav = useNavigate();
  const profile = useResident();
  const [how, setHow] = useState(false);
  if (!profile) return null;

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">More</h1>
        <p className="mt-1 text-deep-foreground/75">{profile.full_name} · House {profile.house_number} · {codeToUnit(profile.house_unit)}</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          <li><Link to="/insights" className={row}><span className={`${ico} bg-mint-light text-deep`}><BarChart3 className="size-5" /></span><span className="flex-1">Insights</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/hadith" className={row}><span className={`${ico} bg-gold-light text-gold-text`}><BookOpen className="size-5" /></span><span className="flex-1">Hadith</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/change-pin" className={row}><span className={`${ico} bg-mint-light text-deep`}><KeyRound className="size-5" /></span><span className="flex-1">Change my PIN</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          {!isInstalled() && (
            <li><button onClick={async () => { if (!(await promptInstall())) setHow(true); }} className={row}><span className={`${ico} bg-mint-light text-deep`}><Smartphone className="size-5" /></span><span className="flex-1">Add to Home Screen</span><ChevronRight className="size-5 text-muted-foreground" /></button></li>
          )}
          <li><Link to="/sos" className={row}><span className={`${ico} bg-destructive/10 text-destructive`}><ShieldAlert className="size-5" /></span><span className="flex-1">SOS emergency</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
        </ul>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            nav("/login", { replace: true });
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card font-semibold text-destructive"
        >
          <LogOut className="size-5" /> Log out
        </button>
      </Sheet>
      <ResidentTabs />
      <BottomSheet open={how} onClose={() => setHow(false)} title="Add to Home Screen">
        <div className="space-y-3 pb-4 text-base text-text-2">
          <p>iPhone: tap the Share icon, then Add to Home Screen.</p>
          <p>Android: tap the menu (three dots), then Add to Home screen.</p>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default More;
