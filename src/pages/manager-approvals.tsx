import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Megaphone } from "lucide-react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { formatWhen } from "@/lib/when";

export const title = "Approvals";

type Pending = { id: string; full_name: string; house_number: string; house_unit: string; created_at: string };

function Approvals() {
  const nav = useNavigate();
  const me = useManager();
  const [stats, setStats] = useState<{ codes_today: number; inside_now: number } | null>(null);
  const [list, setList] = useState<Pending[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) return;
    supabase.rpc("manager_today_stats").then(({ data }) => data && setStats(data));
    supabase
      .from("profiles")
      .select("id,full_name,house_number,house_unit,created_at")
      .eq("role", "resident")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setList((data ?? []) as Pending[]);
      });
  }, [me]);

  if (!me) return null;

  return (
    <Screen>
      <Hero>
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-3xl font-semibold">Approvals</h1>
          <div className="-mr-2 flex items-center gap-1">
          <Link to="/manager/announce" className="flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold text-white">
            <Megaphone className="size-4" /> Announce
          </Link>
          <button
            aria-label="Sign out"
            onClick={async () => {
              await supabase.auth.signOut();
              nav("/manager/login");
            }}
            className="flex size-11 items-center justify-center rounded-full text-deep-foreground/80"
          >
            <LogOut className="size-5" />
          </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 divide-x divide-deep-foreground/15 rounded-sm bg-deep-dark/40 py-3">
          <div className="px-4"><p className="font-display text-2xl font-bold">{stats?.codes_today ?? "–"}</p><p className="text-xs text-deep-foreground/70">Codes issued today</p></div>
          <div className="px-4"><p className="font-display text-2xl font-bold">{stats?.inside_now ?? "–"}</p><p className="text-xs text-deep-foreground/70">People inside now</p></div>
        </div>
      </Hero>
      <Sheet>
        <h2 className="mb-3 text-lg font-semibold">Waiting for approval</h2>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {list && list.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">No one is waiting for approval.</p>}
        <ul className="divide-y divide-border">
          {(list ?? []).map((p) => (
            <li key={p.id}>
              <Link to={`/manager/approvals/${p.id}`} className="flex min-h-18 items-center gap-3 py-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-gold-light font-display font-semibold text-gold-text">{p.full_name[0]}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{p.full_name}</span>
                  <span className="block text-sm text-text-2">House {p.house_number} · {codeToUnit(p.house_unit)}</span>
                  <span className="block text-xs text-muted-foreground">{formatWhen(p.created_at)}</span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default Approvals;
