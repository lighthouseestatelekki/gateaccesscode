import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, UserMinus, UserPlus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ResidentTabs } from "@/components/lh/nav";
import { Initial } from "@/components/lh/CodeTicket";
import { pinAuth } from "@/lib/staffAdmin";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useResident } from "@/lib/useResident";
import { cn } from "@/lib/utils";

export const title = "My household";

type Person = { id: string; full_name: string; relation: string | null; household_role: "primary" | "member"; member_no: number | null; status: string; phone: string | null; is_me: boolean };
const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Other"] as const;

/** Adults in the house, each with their own PIN. The main resident adds and removes them. */
function Household() {
  const profile = useResident();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState<string>("Spouse");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState<{ pin: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("my_household");
    if (err) setLoadError("Household members are not switched on yet. Please check back soon.");
    setPeople((data ?? []) as Person[]);
  }, []);
  useEffect(() => {
    if (profile) load();
  }, [profile, load]);

  async function add() {
    if (name.trim().length < 2) return setError("Please enter their full name.");
    setBusy(true);
    setError("");
    try {
      const r = await pinAuth<{ temp_pin: string }>({ action: "add_member", full_name: name.trim(), phone: phone.trim(), email: email.trim(), relation });
      setAdding(false);
      setTemp({ pin: r.temp_pin, name: name.trim().split(/\s+/)[0] ?? name });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await pinAuth({ action: "remove_member", profile_id: removing.id });
      setRemoving(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (!profile) return null;
  const me = people?.find((p) => p.is_me);
  const main = people?.find((p) => p.household_role === "primary");
  const iAmMain = me?.household_role === "primary";
  const activeMembers = (people ?? []).filter((p) => p.household_role === "member" && p.status === "active").length;

  return (
    <Screen>
      <Hero>
        <Link to="/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">My household</h1>
        <p className="mt-1 text-deep-foreground/75">House {profile.house_number} · {codeToUnit(profile.house_unit)}. Each adult has their own PIN, so nobody shares one.</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        {loadError && <p className="rounded-2xl bg-gold-light p-3 text-sm font-medium text-gold-text">{loadError}</p>}
        {iAmMain && (
          <Button disabled={activeMembers >= 6} onClick={() => { setName(""); setPhone(""); setEmail(""); setRelation("Spouse"); setError(""); setAdding(true); }}>
            <UserPlus className="size-5" /> Add a household member
          </Button>
        )}
        {me && !iAmMain && main && (
          <p className="rounded-2xl bg-mint-lightest p-3 text-sm text-deep">{main.full_name} is the main resident. Ask them to add or remove people.</p>
        )}
        <ul className="divide-y divide-border overflow-hidden rounded-[22px] border border-border bg-card">
          {(people ?? []).map((p) => (
            <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <Initial name={p.full_name} className={cn("size-11 text-base", p.status !== "active" && "opacity-50")} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{p.full_name}</span>
                  {p.is_me && <span className="shrink-0 rounded-full bg-mint-light px-2 py-0.5 text-[11px] font-bold text-deep">You</span>}
                </p>
                <p className="flex items-center gap-1 text-sm text-text-2">
                  {p.household_role === "primary" ? <><Crown className="size-3.5 text-gold-text" /> Main resident</> : (p.relation ?? "Household member")}
                  {p.status !== "active" && " · Removed"}
                </p>
              </div>
              {iAmMain && p.household_role === "member" && p.status === "active" && (
                <button aria-label={`Remove ${p.full_name}`} onClick={() => { setError(""); setRemoving(p); }} className="flex size-11 items-center justify-center rounded-full text-destructive"><UserMinus className="size-5" /></button>
              )}
            </li>
          ))}
          {people && people.length === 0 && !loadError && <li className="p-6 text-center text-text-2">Nothing here yet.</li>}
        </ul>
        {iAmMain && <p className="text-center text-xs text-muted-foreground">Up to 6 people. The Estate Manager is told when someone is added.</p>}
      </Sheet>
      <ResidentTabs />

      <BottomSheet open={adding} onClose={() => !busy && setAdding(false)} title="Add a household member">
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Phone (optional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-2">Relationship to you</p>
            <div role="radiogroup" aria-label="Relationship to you" className="grid grid-cols-3 gap-2">
              {RELATIONS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={relation === r} onClick={() => setRelation(r)} className={cn("min-h-11 rounded-2xl border-[1.5px] text-sm font-semibold", relation === r ? "border-primary bg-mint-light text-deep" : "border-border bg-card text-text-2")}>{r}</button>
              ))}
            </div>
          </div>
          <Field label="Email for their alerts (optional)" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={add}>{busy ? "Adding…" : "Add and get their PIN"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!temp} onClose={() => setTemp(null)} title={temp ? `${temp.name}'s first PIN` : ""}>
        {temp && (
          <div className="space-y-4 pb-4 text-center">
            <p className="code-digits rounded-2xl bg-mint-lightest py-6 text-5xl font-bold text-deep">{temp.pin.slice(0, 3)} {temp.pin.slice(3)}</p>
            <p className="text-text-2">Give this to {temp.name} in person. They sign in with <b>House {profile.house_number} · {codeToUnit(profile.house_unit)}</b> and this PIN, then choose their own.</p>
            <Button onClick={() => setTemp(null)}>Done</Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!removing} onClose={() => !busy && setRemoving(null)} title={removing ? `Remove ${removing.full_name}?` : ""}>
        <div className="space-y-3 pb-4">
          <p className="text-base text-text-2">They will be signed out of every phone and can no longer create codes. Codes they already shared stop when they expire.</p>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button variant="danger" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Yes, remove"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Keep</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Household;
