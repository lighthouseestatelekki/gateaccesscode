import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BarChart3, BookOpen, ChevronRight, Download, KeyRound, LogOut, ShieldAlert, ShieldCheck, Smartphone, Truck, UsersRound, Wrench } from "lucide-react";
import { BottomSheet, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ResidentTabs } from "@/components/lh/nav";
import { isInstalled, promptInstall } from "@/lib/install";
import { supabase } from "@/lib/supabase";
import { ThemePicker } from "@/components/lh/ThemePicker";
import { WeeklyEmailToggle } from "@/components/lh/WeeklyEmailToggle";
import { LangPicker } from "@/components/lh/LangPicker";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";

/** Saves everything the app holds about me as a file. */
function DownloadMyData() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function go() {
    setState("busy");
    const { data, error } = await supabase.rpc("my_data_export");
    if (error || !data) return setState("error");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `light-house-estate-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setState("done");
  }
  return (
    <button onClick={go} disabled={state === "busy"} className={row}>
      <span className={`${ico} bg-mint-light text-deep`}><Download className="size-5" /></span>
      <span className="flex-1">{state === "busy" ? "Preparing…" : state === "done" ? "Downloaded" : state === "error" ? "Not available yet" : "Download my data"}</span>
    </button>
  );
}

/** Sign out every other phone where I'm signed in (keeps this one). */
function OtherDevices() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <button
      disabled={state !== "idle"}
      onClick={async () => {
        setState("busy");
        await supabase.auth.signOut({ scope: "others" });
        setState("done");
      }}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-[15px] font-semibold text-deep"
    >
      {state === "done" ? "Signed out of your other phones" : state === "busy" ? "Signing out…" : "Sign out of my other phones"}
    </button>
  );
}

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
          <li><Link to="/household" className={row}><span className={`${ico} bg-mint-light text-deep`}><UsersRound className="size-5" /></span><span className="flex-1">My household</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/fixit" className={row}><span className={`${ico} bg-gold-light text-gold-text`}><Wrench className="size-5" /></span><span className="flex-1">Fix-It requests</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/insights" className={row}><span className={`${ico} bg-mint-light text-deep`}><BarChart3 className="size-5" /></span><span className="flex-1">Insights</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/hadith" className={row}><span className={`${ico} bg-gold-light text-gold-text`}><BookOpen className="size-5" /></span><span className="flex-1">Hadith</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/change-pin" className={row}><span className={`${ico} bg-mint-light text-deep`}><KeyRound className="size-5" /></span><span className="flex-1">Change my PIN</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          {!isInstalled() && (
            <li><button onClick={async () => { if (!(await promptInstall())) setHow(true); }} className={row}><span className={`${ico} bg-mint-light text-deep`}><Smartphone className="size-5" /></span><span className="flex-1">Install App</span><ChevronRight className="size-5 text-muted-foreground" /></button></li>
          )}
          <li><Link to="/moving" className={row}><span className={`${ico} bg-mint-light text-deep`}><Truck className="size-5" /></span><span className="flex-1">Moving out</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><Link to="/sos" className={row}><span className={`${ico} bg-destructive/10 text-destructive`}><ShieldAlert className="size-5" /></span><span className="flex-1">SOS emergency</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
        </ul>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          <li><Link to="/privacy" className={row}><span className={`${ico} bg-mint-light text-deep`}><ShieldCheck className="size-5" /></span><span className="flex-1">Privacy notice</span><ChevronRight className="size-5 text-muted-foreground" /></Link></li>
          <li><DownloadMyData /></li>
        </ul>
        <WeeklyEmailToggle />
        <OtherDevices />
        <LangPicker />
        <ThemePicker />
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
      <BottomSheet open={how} onClose={() => setHow(false)} title="Install App">
        <div className="space-y-3 pb-4 text-base text-text-2">
          <p>iPhone: tap the Share icon, then Add to Home Screen.</p>
          <p>Android: tap the menu (three dots), then Add to Home screen.</p>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default More;
