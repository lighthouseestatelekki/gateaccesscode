import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BottomSheet, Button, Hero, ManagerTabs, Screen, Sheet } from "@/components/lh/ui";
import { pending } from "@/mock/data";

export const title = "Registration details";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-text-2">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Detail() {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const p = pending[0]!;
  return (
    <Screen>
      <Hero>
        <Link to="/manager/approvals" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">{p.name}</h1>
        <p className="text-deep-foreground/70">House {p.house} · {p.unit}</p>
      </Hero>
      <Sheet className="space-y-6">
        <dl className="divide-y divide-border">
          <Row k="Phone" v={p.phone!} />
          <Row k="Email" v={p.email!} />
          <Row k="House number" v={p.house} />
          <Row k="Unit" v={p.unit} />
          <Row k="Submitted" v={p.submitted} />
        </dl>
        <section className="rounded-lg bg-mint-lightest p-4">
          <h2 className="mb-1 font-semibold">Next of kin</h2>
          <dl className="divide-y divide-border">
            <Row k="Name" v={p.kin!.name} />
            <Row k="Phone" v={p.kin!.phone} />
            <Row k="Relationship" v={p.kin!.relationship} />
          </dl>
        </section>
        <div className="space-y-3 pb-4">
          <Button onClick={() => nav("/manager/approvals")}>Approve</Button>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirm(true)}>Decline</Button>
        </div>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title="Decline this registration?">
        <div className="space-y-3 pb-4">
          <Button variant="danger" onClick={() => nav("/manager/approvals")}>Yes, decline</Button>
          <Button variant="outline" onClick={() => setConfirm(false)}>Go back</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default Detail;
