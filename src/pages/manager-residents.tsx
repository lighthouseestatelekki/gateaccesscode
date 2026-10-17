
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { BottomSheet, Button, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { residents } from "@/mock/data";

export const title = "Residents";

function Residents() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<(typeof residents)[number] | null>(null);
  const [reset, setReset] = useState(false);
  const list = residents.filter((r) => r.house.includes(q.trim()));
  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Residents</h1>
      </Hero>
      <Sheet className="space-y-4">
        <label className="relative block">
          <Search className="absolute left-4 top-3.5 size-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Search by house number" className="h-12 w-full rounded-sm border border-border bg-card pl-12 pr-4 outline-none focus:border-primary" />
        </label>
        <ul className="divide-y divide-border">
          {list.map((r) => (
            <li key={r.name}>
              <button onClick={() => setSel(r)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                <span className="flex size-11 items-center justify-center rounded-full bg-mint-light font-display font-semibold text-deep">{r.house}</span>
                <span className="flex-1"><span className="block font-semibold">{r.name}</span><span className="block text-sm text-text-2">House {r.house} · {r.unit}</span></span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-text-2">No residents found.</li>}
        </ul>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={!!sel && !reset} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <div className="space-y-4 pb-4">
            <dl className="space-y-2 text-base">
              <div className="flex justify-between"><dt className="text-text-2">House</dt><dd className="font-medium">{sel.house} · {sel.unit}</dd></div>
              <div className="flex justify-between"><dt className="text-text-2">Phone</dt><dd className="font-medium">{sel.phone}</dd></div>
            </dl>
            <Button variant="secondary" onClick={() => setReset(true)}>Reset PIN</Button>
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={reset} onClose={() => { setReset(false); setSel(null); }} title="Temporary PIN">
        <div className="space-y-4 pb-4 text-center">
          <p className="code-digits rounded-lg bg-mint-lightest py-6 text-5xl font-bold text-deep">482 915</p>
          <p className="text-text-2">Give this to the resident. They will choose their own PIN at next login.</p>
          <Button onClick={() => { setReset(false); setSel(null); }}>Done</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Residents;
