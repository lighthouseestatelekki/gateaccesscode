import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Field, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { formatWhen } from "@/lib/when";

export const title = "Announcements";

// Ready-made notices: tap one, then change the [bracketed] parts.
const TEMPLATES = [
  { k: "Water", t: "Water supply notice", b: "Assalam Alaekum, dear residents.\n\nThere will be no water supply on [DAY] from [TIME] to [TIME] for maintenance. Please store enough water.\n\nJazakAllahu Khairan." },
  { k: "Power", t: "Power supply notice", b: "Assalam Alaekum, dear residents.\n\nThere will be a power interruption on [DAY] from [TIME] to [TIME]. We apologise for the inconvenience.\n\nJazakAllahu Khairan." },
  { k: "Meeting", t: "Estate meeting", b: "Assalam Alaekum, dear residents.\n\nThe estate meeting holds on [DAY] at [TIME] at [VENUE]. Your attendance is important.\n\nJazakAllahu Khairan." },
  { k: "Security", t: "Security notice", b: "Assalam Alaekum, dear residents.\n\n[WHAT RESIDENTS NEED TO KNOW]. Please share visitor codes only with people you are expecting.\n\nJazakAllahu Khairan." },
  { k: "Sanitation", t: "Sanitation day", b: "Assalam Alaekum, dear residents.\n\nSanitation holds on [DAY] from [TIME] to [TIME]. Movement in and out of the estate may be limited.\n\nJazakAllahu Khairan." },
] as const;

type Ann = { id: string; title: string; body: string; created_at: string; recipients: number };

function Announce() {
  const me = useManager();
  const [list, setList] = useState<Ann[] | null>(null);
  const [t, setT] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("announcements").select("id,title,body,created_at,recipients").order("created_at", { ascending: false }).limit(30);
    setList((data ?? []) as Ann[]);
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function send() {
    if (/\[[A-Z ]+\]/.test(b) || /\[[A-Z ]+\]/.test(t)) {
      setError("Please replace the [bracketed] parts before sending.");
      return;
    }
    if (!t.trim() || !b.trim()) {
      setError("Please write a title and a message.");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    const { data, error: err } = await supabase.rpc("post_announcement", { p_title: t.trim(), p_body: b.trim() });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setT("");
    setB("");
    setDone(`Sent to ${(data as Ann).recipients} resident${(data as Ann).recipients === 1 ? "" : "s"}.`);
    await load();
  }

  if (!me) return null;
  return (
    <Screen>
      <Hero>
        <Link to="/manager/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Announcements</h1>
        <p className="mt-1 text-deep-foreground/70">Goes to every approved resident's inbox.</p>
      </Hero>
      <Sheet className="space-y-5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-text-2">Start from a template</p>
          <div className="scrollbar-hidden -mx-5 flex gap-2 overflow-x-auto px-5">
            {TEMPLATES.map((x) => (
              <button key={x.k} type="button" onClick={() => { setT(x.t); setB(x.b); setDone(""); setError(""); }} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${t === x.t ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2"}`}>{x.k}</button>
            ))}
          </div>
        </div>
        <Field label="Title" maxLength={120} value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. Water supply notice" />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-2">Message</span>
          <textarea value={b} maxLength={2000} onChange={(e) => setB(e.target.value)} rows={5} className="w-full rounded-2xl border-[1.5px] border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        </label>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {done && <p role="status" className="rounded-lg bg-mint-lightest p-3 text-sm font-medium text-deep">{done}</p>}
        <Button disabled={busy} onClick={send}>{busy ? "Sending…" : "Send to all residents"}</Button>
        <section>
          <h2 className="mb-2 text-lg font-semibold">Sent</h2>
          {list && list.length === 0 && <p className="text-text-2">No announcements yet.</p>}
          <ul className="divide-y divide-border">
            {(list ?? []).map((a) => (
              <li key={a.id} className="py-3">
                <p className="font-semibold">{a.title}</p>
                <p className="whitespace-pre-line text-text-2">{a.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatWhen(a.created_at)} · {a.recipients} resident{a.recipients === 1 ? "" : "s"}</p>
              </li>
            ))}
          </ul>
        </section>
      </Sheet>
      <ManagerTabs />
    </Screen>
  );
}

export default Announce;
