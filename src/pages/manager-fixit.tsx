import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { FixitCard } from "@/components/lh/FixitCard";
import { FIXIT_COLUMNS, photoUrls, STATUS_LABEL, type Fixit, type FixitStatus } from "@/lib/fixit";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { cn } from "@/lib/utils";

export const title = "Fix-It requests";

const NEXT: Record<FixitStatus, { to: FixitStatus; label: string }[]> = {
  open: [{ to: "in_progress", label: "Start work" }, { to: "done", label: "Mark done" }],
  in_progress: [{ to: "done", label: "Mark done" }],
  done: [{ to: "open", label: "Reopen" }],
};

/** Estate Manager: every Fix-It request, by status, with one-tap progress and a note for the resident. */
function ManagerFixit() {
  const me = useManager();
  const [tab, setTab] = useState<FixitStatus>("open");
  const [list, setList] = useState<Fixit[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("fixit_requests").select(FIXIT_COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (err) setError(err.message);
    const rows = (data ?? []) as Fixit[];
    setList(rows);
    setPhotos(await photoUrls(rows.map((r) => r.photo_path).filter((p): p is string => !!p)));
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function move(r: Fixit, to: FixitStatus) {
    setBusy(r.id + to);
    setError("");
    const { error: err } = await supabase.rpc("set_fixit_status", { p_id: r.id, p_status: to, p_note: notes[r.id]?.trim() || null });
    setBusy("");
    if (err) return setError(err.message);
    setNotes((n) => ({ ...n, [r.id]: "" }));
    await load();
  }

  if (!me) return null;
  const count = (s: FixitStatus) => (list ?? []).filter((r) => r.status === s).length;
  const shown = (list ?? []).filter((r) => r.status === tab);

  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Fix-It requests</h1>
        <div role="tablist" aria-label="Status" className="mt-4 grid grid-cols-3 gap-1.5 rounded-[20px] bg-black/15 p-1.5">
          {(["open", "in_progress", "done"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className={cn("flex flex-col items-center rounded-2xl py-2", tab === s ? "bg-card text-deep shadow-sm" : "text-deep-foreground")}>
              <span className="font-display text-2xl font-extrabold leading-none">{list ? count(s) : "–"}</span>
              <span className={cn("mt-1 text-xs font-semibold", tab === s ? "text-text-2" : "text-deep-foreground/70")}>{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
      </Hero>
      <Sheet className="space-y-3 pb-6">
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {list && shown.length === 0 && <p className="rounded-[22px] border-2 border-dashed border-border p-6 text-center text-text-2">Nothing here.</p>}
        <ul className="space-y-3">
          {shown.map((r) => (
            <FixitCard key={r.id} r={r} showHouse photo={r.photo_path ? photos[r.photo_path] : undefined}>
              <div className="mt-3 space-y-2">
                <input
                  aria-label={`Note to the resident for request ${r.ref}`}
                  placeholder="Note to the resident (optional)"
                  value={notes[r.id] ?? ""}
                  maxLength={500}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  className="h-11 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  {NEXT[r.status].map((n) => (
                    <button key={n.to} disabled={!!busy} onClick={() => move(r, n.to)} className={cn("min-h-11 flex-1 rounded-full text-sm font-bold", n.to === "done" ? "bg-deep text-deep-foreground" : "bg-mint-light text-deep")}>
                      {busy === r.id + n.to ? "…" : n.label}
                    </button>
                  ))}
                </div>
              </div>
            </FixitCard>
          ))}
        </ul>
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default ManagerFixit;
