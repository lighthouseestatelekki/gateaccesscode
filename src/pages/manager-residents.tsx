import { useEffect, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { BottomSheet, Button, btnClass, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { staffAdmin } from "@/lib/staffAdmin";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { SignOutEverywhere } from "@/components/lh/SignOutEverywhere";

export const title = "Residents";

type Resident = { id: string; full_name: string; house_number: string; house_unit: string; phone: string | null; status: string; household_role?: string | null; relation?: string | null };

function Residents() {
  const me = useManager();
  const [all, setAll] = useState<Resident[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Resident | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "resident")
      .in("status", ["active", "suspended"])
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        const rows = (data ?? []) as Resident[];
        rows.sort((a, b) => Number(a.house_number) - Number(b.house_number) || a.house_unit.localeCompare(b.house_unit) || (a.household_role === "member" ? 1 : 0) - (b.household_role === "member" ? 1 : 0));
        setAll(rows);
      });
  }, [me]);

  async function resetPin() {
    if (!sel) return;
    setBusy(true);
    setError("");
    try {
      const r = await staffAdmin<{ temp_pin: string }>({ action: "reset_pin", profile_id: sel.id });
      setTemp(r.temp_pin);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function close() {
    if (busy) return;
    setSel(null);
    setTemp(null);
    setError("");
  }

  if (!me) return null;
  const query = q.trim();
  const list = (all ?? []).filter((r) => !query || r.house_number === query || r.house_number.startsWith(query));

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Residents</h1>
      </Hero>
      <Sheet className="space-y-4">
        <label className="relative block">
          <Search className="absolute left-4 top-3.5 size-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Search by house number" className="h-12 w-full rounded-sm border border-border bg-card pl-12 pr-4 outline-none focus:border-primary" />
        </label>
        {error && !sel && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <ul className="divide-y divide-border">
          {list.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSel(r)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                <span className="flex size-11 items-center justify-center rounded-full bg-mint-light font-display font-semibold text-deep">{r.house_number}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{r.full_name}</span>
                  <span className="block text-sm text-text-2">House {r.house_number} · {codeToUnit(r.house_unit)}{r.household_role === "member" ? ` · Household member${r.relation ? ` (${r.relation})` : ""}` : ""}{r.status === "suspended" ? " · Suspended" : ""}</span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            </li>
          ))}
          {all && list.length === 0 && <li className="py-6 text-center text-text-2">No residents found.</li>}
        </ul>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={!!sel && !temp} onClose={close} title={sel?.full_name ?? ""}>
        {sel && (
          <div className="space-y-4 pb-4">
            <dl className="space-y-2 text-base">
              <div className="flex justify-between"><dt className="text-text-2">House</dt><dd className="font-medium">{sel.house_number} · {codeToUnit(sel.house_unit)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-2">Phone</dt><dd className="font-medium">{sel.phone ?? "—"}</dd></div>
            </dl>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Link to={`/manager/house/${sel.id}`} className={btnClass("primary")}>Codes for this house</Link>
            <Button variant="secondary" disabled={busy} onClick={resetPin}>{busy ? "Resetting…" : "Reset PIN"}</Button>
            <SignOutEverywhere key={sel.id} userId={sel.id} name={sel.full_name} />
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={!!temp} onClose={close} title="Temporary PIN">
        <div className="space-y-4 pb-4 text-center">
          <p className="code-digits rounded-lg bg-mint-lightest py-6 text-5xl font-bold text-deep">{temp ? `${temp.slice(0, 3)} ${temp.slice(3)}` : ""}</p>
          <p className="text-text-2">Give this to the resident. They will choose their own PIN at next login.</p>
          <Button onClick={close}>Done</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Residents;
