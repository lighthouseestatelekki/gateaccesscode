import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Trash2, X } from "lucide-react";
import { Button } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { myPasskeys, passkeyOnThisPhone, passkeySupported, registerPasskey, removePasskey, setPasskeyOnThisPhone, type PasskeyRow } from "@/lib/passkey";

const DISMISS = "lh.passkeyOffer";

function useSupported() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    passkeySupported().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

/** A one-time offer: "Sign in with your fingerprint next time". Hidden once turned on or dismissed. */
export function FingerprintOffer({ className, backup = "PIN" }: { className?: string; backup?: "PIN" | "password" }) {
  const supported = useSupported();
  const [hidden, setHidden] = useState(() => {
    try {
      return passkeyOnThisPhone() || localStorage.getItem(DISMISS) === "1";
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (!supported || (hidden && !done)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  if (done) {
    return (
      <div role="status" className={`flex items-center gap-3 rounded-lg bg-mint-light p-4 text-deep ${className ?? ""}`}>
        <Fingerprint className="size-6 shrink-0" />
        <p className="flex-1 text-sm font-semibold">Done. Next time, sign in with your fingerprint.</p>
        <button aria-label="Close" onClick={() => setDone(false)} className="flex size-9 items-center justify-center"><X className="size-4" /></button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Fingerprint className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Sign in with your fingerprint</p>
          <p className="text-sm text-text-2">
            {backup === "PIN"
              ? "Faster than typing. Your PIN still works as a backup. Your fingerprint never leaves your phone."
              : "Faster than typing, and it counts as your two-step check. Your password still works as a backup. Your fingerprint never leaves your phone."}
          </p>
        </div>
        <button aria-label="Not now" onClick={dismiss} className="-me-2 -mt-2 flex size-10 items-center justify-center text-muted-foreground"><X className="size-4" /></button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      <Button
        className="mt-3 min-h-12"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await registerPasskey();
            setDone(true);
            setHidden(true);
          } catch (e) {
            setError((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {busy ? "Setting up…" : "Turn on"}
      </Button>
    </div>
  );
}

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Settings: the phones that can sign in with a fingerprint, add this phone, remove one. */
export function FingerprintSettings({ userId: given }: { userId?: string }) {
  const [userId, setUserId] = useState(given ?? "");
  useEffect(() => {
    if (given) return;
    supabase.auth.getSession().then(({ data }) => setUserId(data?.session?.user?.id ?? ""));
  }, [given]);
  const supported = useSupported();
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onHere, setOnHere] = useState(passkeyOnThisPhone);
  const load = useCallback(async () => {
    if (userId) setRows(await myPasskeys(userId));
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError("");
    try {
      await registerPasskey();
      setOnHere(true);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(r: PasskeyRow) {
    if (!window.confirm(`Remove fingerprint sign-in for "${r.device_name ?? "this phone"}"?`)) return;
    setError("");
    try {
      await removePasskey(r.id);
      const left = (rows ?? []).filter((x) => x.id !== r.id);
      if (left.length === 0) {
        setPasskeyOnThisPhone(false);
        setOnHere(false);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!supported && !rows?.length) return null;

  return (
    <section aria-labelledby="fp-h" className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-light text-deep"><Fingerprint className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="fp-h" className="text-base font-semibold">Fingerprint sign-in</h2>
          <p className="text-sm text-text-2">{rows?.length ? "These phones can sign in with a fingerprint or face." : "Sign in with your fingerprint instead of typing."}</p>
        </div>
      </div>
      {!!rows?.length && (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-14 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.device_name ?? "Phone"}</span>
                <span className="block text-xs text-muted-foreground">Added {when(r.created_at)} · last used {when(r.last_used_at)}</span>
              </span>
              <button aria-label={`Remove ${r.device_name ?? "phone"}`} onClick={() => remove(r)} className="flex size-11 items-center justify-center rounded-full text-destructive">
                <Trash2 className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      {supported && !onHere && (
        <Button variant="secondary" className="mt-3 min-h-12" disabled={busy} onClick={add}>
          {busy ? "Setting up…" : rows?.length ? "Add this phone" : "Turn on for this phone"}
        </Button>
      )}
    </section>
  );
}
