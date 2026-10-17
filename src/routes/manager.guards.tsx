import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { BottomSheet, Button, Field, Hero, ManagerTabs, meta, PinEntry, Screen, Sheet } from "@/components/lh/ui";
import { guards } from "@/mock/data";

export const Route = createFileRoute("/manager/guards")({
  head: () => meta("Guards", "Manage gate guards."),
  component: Guards,
});

function Guards() {
  const [open, setOpen] = useState(false);
  return (
    <Screen>
      <Hero>
        <h1 className="pt-2 text-3xl font-semibold">Guards</h1>
      </Hero>
      <Sheet className="space-y-4">
        <Button onClick={() => setOpen(true)}><Plus className="size-5" /> Add guard</Button>
        <ul className="divide-y divide-border">
          {guards.map((g) => (
            <li key={g.number} className="flex min-h-16 items-center gap-3 py-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-deep font-display font-semibold text-deep-foreground">{g.number}</span>
              <span className="flex-1"><span className="block font-semibold">Guard {g.number}</span><span className="block text-sm text-text-2">{g.name} · {g.gate}</span></span>
              <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-semibold text-deep">{g.status}</span>
            </li>
          ))}
        </ul>
      </Sheet>
      <ManagerTabs />
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add guard">
        <div className="space-y-4 pb-4">
          <Field label="Full name" />
          <Field label="Phone" type="tel" inputMode="tel" />
          <Field label="Guard number" inputMode="numeric" />
          <div><p className="text-sm font-medium text-text-2">Gate</p><p className="mt-1 rounded-sm bg-muted px-4 py-3 font-medium">Gate 1</p></div>
          <PinEntry label="PIN" />
          <Button onClick={() => setOpen(false)}>Add guard</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
