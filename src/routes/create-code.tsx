import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button, Field, Hero, meta, Screen, Sheet } from "@/components/lh/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create-code")({
  head: () => meta("Create access code", "Create a 6-digit access code for a visitor."),
  component: CreateCode,
});

const OPTIONS = ["Next 2 hours", "Today", "Tomorrow", "This weekend", "Pick date and time"];

function CreateCode() {
  const nav = useNavigate();
  const [sel, setSel] = useState("Today");
  return (
    <Screen>
      <Hero>
        <Link to="/home" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-4 text-3xl font-semibold">Create access code</h1>
      </Hero>
      <Sheet className="space-y-6">
        <Field label="Visitor name" placeholder="e.g. Ibrahim Yusuf" />
        <div>
          <p className="mb-2 text-sm font-medium text-text-2">Valid until</p>
          <div className="space-y-2">
            {OPTIONS.map((o) => (
              <button key={o} onClick={() => setSel(o)} className={cn("flex min-h-14 w-full items-center justify-between rounded-lg border-2 px-5 text-left text-base font-semibold transition-colors", sel === o ? "border-primary bg-mint-lightest text-deep" : "border-border bg-card text-foreground")}>
                {o}
                <span className={cn("flex size-6 items-center justify-center rounded-full border-2", sel === o ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{sel === o && <Check className="size-4" />}</span>
              </button>
            ))}
          </div>
          {sel === "Pick date and time" && <input type="datetime-local" className="mt-3 h-12 w-full rounded-sm border border-border bg-card px-4" />}
        </div>
        <Button onClick={() => nav({ to: "/code-created" })}>Create code</Button>
      </Sheet>
    </Screen>
  );
}
