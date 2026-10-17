import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Hero, ManagerTabs, meta, Screen, Sheet } from "@/components/lh/ui";
import { managerStats, pending } from "@/mock/data";

export const Route = createFileRoute("/manager/approvals")({
  head: () => meta("Approvals", "Residents waiting for approval."),
  component: Approvals,
});

function Approvals() {
  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Approvals</h1>
        <div className="mt-5 grid grid-cols-2 divide-x divide-deep-foreground/15 rounded-sm bg-deep-dark/40 py-3">
          <div className="px-4"><p className="font-display text-2xl font-bold">{managerStats.codesToday}</p><p className="text-xs text-deep-foreground/70">Codes issued today</p></div>
          <div className="px-4"><p className="font-display text-2xl font-bold">{managerStats.insideNow}</p><p className="text-xs text-deep-foreground/70">People inside now</p></div>
        </div>
      </Hero>
      <Sheet>
        <h2 className="mb-3 text-lg font-semibold">Waiting for approval</h2>
        <ul className="divide-y divide-border">
          {pending.map((p) => (
            <li key={p.id}>
              <Link to="/manager/approvals/1" className="flex min-h-18 items-center gap-3 py-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-gold-light font-display font-semibold text-gold-text">{p.name[0]}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-sm text-text-2">House {p.house} · {p.unit}</span>
                  <span className="block text-xs text-muted-foreground">{p.submitted}</span>
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
