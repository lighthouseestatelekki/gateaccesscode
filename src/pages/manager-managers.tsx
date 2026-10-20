import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { staffAdmin } from "@/lib/staffAdmin";
import { supabase } from "@/lib/supabase";
import { useManager } from "@/lib/useManager";
import { removePasskey, type PasskeyRow } from "@/lib/passkey";

export const title = "Estate Managers";

type Manager = { id: string; full_name: string; email: string | null; status: string; must_change_pin: boolean | null };
type Key = PasskeyRow & { user_id: string };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

/** Shows a temporary password once, big and clear, to pass on in person. */
function TempPassword({ value, who }: { value: string; who: string }) {
  return (
    <div className="space-y-2 rounded-2xl bg-gold-light p-4 text-center">
      <p className="text-sm font-semibold text-gold-text">Temporary password for {who}</p>
      <p className="code-digits select-all text-3xl font-bold tracking-wide text-deep-dark" data-no-translate>{value}</p>
      <p className="text-xs text-gold-text">Shown only once. Give it to them in person or by phone call, not in a group chat. They choose their own password at first sign-in, then set up their fingerprint or authenticator app.</p>
    </div>
  );
}

function Managers() {
  const me = useManager();
  const [list, setList] = useState<Manager[] | null>(null);
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<Manager | null>(null);
  const [temp, setTemp] = useState<{ value: string; who: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("profiles").select("id,full_name,email,status,must_change_pin").eq("role", "estate_manager").order("full_name");
    if (err) setError(err.message);
    setList((data ?? []) as Manager[]);
    const { data: k } = await supabase.from("passkeys").select("id,user_id,device_name,created_at,last_used_at").order("created_at");
    setKeys((k ?? []) as Key[]);
  }, []);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function add() {
    if (name.trim().length < 2) return setError("Please enter their full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    setError("");
    try {
      const r = await staffAdmin<{ temp_password: string }>({ action: "create_manager", full_name: name.trim(), email: email.trim() });
      setTemp({ value: r.temp_password, who: name.trim() });
      setName("");
      setEmail("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function reset(m: Manager) {
    if (!window.confirm(`Reset ${m.full_name}'s sign-in? Their password, authenticator app and fingerprints will stop working, and they will be signed out everywhere.`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await staffAdmin<{ temp_password: string }>({ action: "reset_manager", profile_id: m.id });
      setTemp({ value: r.temp_password, who: m.full_name });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function setActive(m: Manager, active: boolean) {
    if (!active && !window.confirm(`Pause ${m.full_name}? They will be signed out and cannot sign in until you re-activate them.`)) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("set_manager_status", { p_person: m.id, p_active: active });
    if (err) setError(err.message);
    else {
      setPicked({ ...m, status: active ? "active" : "suspended" });
      await load();
    }
    setBusy(false);
  }

  async function dropKey(k: Key) {
    if (!window.confirm(`Remove fingerprint sign-in for "${k.device_name ?? "this phone"}"?`)) return;
    try {
      await removePasskey(k.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!me) return null;
  const theirKeys = picked ? keys.filter((k) => k.user_id === picked.id) : [];

  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Estate Managers</h1>
        <p className="mt-1 text-deep-foreground/75">Everyone who can approve residents and manage the estate.</p>
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={() => { setAdding(true); setTemp(null); setError(""); }}><Plus className="size-5" /> Add Estate Manager</Button>
        {temp && !adding && !picked && <TempPassword value={temp.value} who={temp.who} />}
        {error && !adding && !picked && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <ul className="divide-y divide-border">
          {(list ?? []).map((m) => {
            const n = keys.filter((k) => k.user_id === m.id).length;
            return (
              <li key={m.id}>
                <button onClick={() => { setPicked(m); setTemp(null); setError(""); }} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                  <span className="flex size-11 items-center justify-center rounded-full bg-gold-light font-display font-semibold text-gold-text">{m.full_name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.full_name}{m.id === me.id && <span className="font-normal text-text-2"> (you)</span>}</span>
                    <span className="block truncate text-sm text-text-2">{m.email}</span>
                  </span>
                  {m.status !== "active" ? (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-text-2">Paused</span>
                  ) : m.must_change_pin ? (
                    <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-deep-dark">Not signed in yet</span>
                  ) : n > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-semibold text-deep"><Fingerprint className="size-3.5" />{n}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">There must always be at least one active Estate Manager. Every change here is written to the Action history.</p>
      </Sheet>
      <ManagerTabs />

      <BottomSheet open={adding} onClose={() => !busy && setAdding(false)} title="Add Estate Manager">
        <div className="space-y-4 pb-4">
          {temp ? (
            <>
              <TempPassword value={temp.value} who={temp.who} />
              <p className="text-sm text-text-2">They sign in on the Estate Manager screen with their email and this temporary password.</p>
              <Button onClick={() => { setAdding(false); setTemp(null); }}>Done</Button>
            </>
          ) : (
            <>
              <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-sm text-text-2">An Estate Manager can do everything you can, including adding or pausing other Estate Managers.</p>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <Button disabled={busy} onClick={add}>{busy ? "Adding…" : "Add Estate Manager"}</Button>
            </>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={!!picked} onClose={() => !busy && setPicked(null)} title={picked?.full_name ?? ""}>
        {picked && (
          <div className="space-y-3 pb-4">
            <p className="text-sm text-text-2">{picked.email} · {picked.status === "active" ? "Active" : "Paused"}</p>
            <div className="rounded-2xl border border-border p-3">
              <p className="text-sm font-semibold">Fingerprint sign-in</p>
              {theirKeys.length === 0 ? (
                <p className="mt-1 text-sm text-text-2">Not turned on.</p>
              ) : (
                <ul className="mt-1 divide-y divide-border">
                  {theirKeys.map((k) => (
                    <li key={k.id} className="flex min-h-12 items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1"><b>{k.device_name ?? "Phone"}</b><span className="block text-xs text-muted-foreground">Last used {day(k.last_used_at)}</span></span>
                      {picked.id !== me.id && <button onClick={() => dropKey(k)} className="min-h-10 px-2 text-sm font-semibold text-destructive">Remove</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {picked.id === me.id ? (
              <p className="text-sm text-text-2">This is you. Manage your own phones under More → Fingerprint sign-in. To reset your own sign-in, ask another Estate Manager.</p>
            ) : (
              <>
                {temp ? <TempPassword value={temp.value} who={temp.who} /> : (
                  <Button variant="secondary" disabled={busy || picked.status !== "active"} onClick={() => reset(picked)}>{busy ? "Working…" : "Reset sign-in (lost phone or password)"}</Button>
                )}
                {picked.status === "active" ? (
                  <Button variant="danger" disabled={busy} onClick={() => setActive(picked, false)}>Pause this Estate Manager</Button>
                ) : (
                  <Button disabled={busy} onClick={() => setActive(picked, true)}>Re-activate</Button>
                )}
              </>
            )}
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          </div>
        )}
      </BottomSheet>
    </Screen>
  );
}

export default Managers;
