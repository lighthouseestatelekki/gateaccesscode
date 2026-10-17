import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BottomSheet, Button, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { codeToUnit } from "@/lib/units";
import { useManager } from "@/lib/useManager";
import { formatWhen } from "@/lib/when";

export const title = "Registration details";

type Reg = {
  id: string; full_name: string; phone: string | null; email: string | null; house_number: string; house_unit: string;
  status: string; created_at: string; nok_name: string | null; nok_phone: string | null; nok_relationship: string | null;
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-text-2">{k}</dt>
      <dd className="text-right font-medium break-all">{v}</dd>
    </div>
  );
}

function Detail() {
  const nav = useNavigate();
  const { id } = useParams();
  const me = useManager();
  const [p, setP] = useState<Reg | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me || !id) return;
    supabase
      .from("profiles")
      .select("id,full_name,phone,email,house_number,house_unit,status,created_at,nok_name,nok_phone,nok_relationship")
      .eq("id", id)
      .eq("role", "resident")
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError(err?.message ?? "Registration not found.");
        else setP(data as Reg);
      });
  }, [me, id]);

  async function decide(status: "active" | "declined") {
    if (!p) return;
    setBusy(true);
    setError("");
    // .select() returns the changed rows, so we can confirm exactly one row really changed.
    const { data, error: err } = await supabase.from("profiles").update({ status }).eq("id", p.id).eq("status", "pending").select("id");
    if (err || !data || data.length !== 1) {
      setError(err?.message ?? "Nothing was changed. It may already have been approved or declined.");
      setBusy(false);
      setConfirm(false);
      return;
    }
    nav("/manager/approvals", { replace: true });
  }

  if (!me) return null;

  return (
    <Screen>
      <Hero>
        <Link to="/manager/approvals" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">{p?.full_name ?? " "}</h1>
        {p && <p className="text-deep-foreground/70">House {p.house_number} · {codeToUnit(p.house_unit)}</p>}
      </Hero>
      <Sheet className="space-y-6">
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {p && (
          <>
            <dl className="divide-y divide-border">
              <Row k="Phone" v={p.phone ?? "—"} />
              <Row k="Email" v={p.email ?? "—"} />
              <Row k="House number" v={p.house_number} />
              <Row k="Unit" v={codeToUnit(p.house_unit)} />
              <Row k="Submitted" v={formatWhen(p.created_at)} />
            </dl>
            <section className="rounded-lg bg-mint-lightest p-4">
              <h2 className="mb-1 font-semibold">Next of kin</h2>
              <dl className="divide-y divide-border">
                <Row k="Name" v={p.nok_name ?? "—"} />
                <Row k="Phone" v={p.nok_phone ?? "—"} />
                <Row k="Relationship" v={p.nok_relationship ?? "—"} />
              </dl>
            </section>
            {p.status === "pending" ? (
              <div className="space-y-3 pb-4">
                <Button disabled={busy} onClick={() => decide("active")}>{busy ? "Saving…" : "Approve"}</Button>
                <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setConfirm(true)}>Decline</Button>
              </div>
            ) : (
              <p className="rounded-lg bg-muted p-4 text-center text-text-2">This registration is already {p.status === "active" ? "approved" : p.status}.</p>
            )}
          </>
        )}
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={confirm} onClose={() => !busy && setConfirm(false)} title="Decline this registration?">
        <div className="space-y-3 pb-4">
          <Button variant="danger" disabled={busy} onClick={() => decide("declined")}>{busy ? "Saving…" : "Yes, decline"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Go back</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Detail;
