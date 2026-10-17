import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button, btnClass, HadithLine, Hero, meta, Screen, Sheet } from "@/components/lh/ui";

export const Route = createFileRoute("/code-created")({
  head: () => meta("Code created", "Your visitor access code is ready."),
  component: CodeCreated,
});

function CodeCreated() {
  const [copied, setCopied] = useState(false);
  return (
    <Screen>
      <Hero className="pb-16 text-center">
        <p className="pt-6 text-sm font-semibold uppercase tracking-widest text-deep-foreground/60">Access code</p>
        <p className="code-digits mt-3 text-6xl font-bold text-gold">184 302</p>
        <p className="mt-4 text-lg font-semibold">Ibrahim Yusuf</p>
        <p className="text-sm text-deep-foreground/70">Until today, 6:00 PM</p>
      </Hero>
      <Sheet className="space-y-3">
        <div className="pb-3 text-center">
          <h1 className="text-2xl font-semibold">JazakAllahu Khairan.</h1>
          <p className="mt-1 text-text-2">Show this code to the guard at the gate.</p>
        </div>
        <Button><Share2 className="size-5" /> Share</Button>
        <Button variant="secondary" onClick={() => setCopied(true)}><Copy className="size-5" /> {copied ? "Copied" : "Copy code"}</Button>
        <Link to="/home" className={btnClass("outline")}>Done</Link>
        <p className="text-center"><Link to="/create-code" className="inline-flex min-h-11 items-center font-semibold text-deep">Create another</Link></p>
        <HadithLine className="pt-4" />
      </Sheet>
    </Screen>
  );
}
