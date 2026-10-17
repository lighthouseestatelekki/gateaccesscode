import { createFileRoute } from "@tanstack/react-router";
import { meta, Verdict } from "@/components/lh/guard";

export const Route = createFileRoute("/guard/verdict/access")({
  head: () => meta("Access", "Visitor code accepted."),
  component: () => (
    <Verdict tone="access" title="ACCESS">
      <p className="mx-auto w-fit rounded-lg bg-deep px-8 py-2 font-display text-5xl font-bold text-deep-foreground">IN</p>
      <p className="pt-4 text-3xl font-bold">Ibrahim Yusuf</p>
      <p className="text-2xl font-semibold">House 14 · Main house</p>
      <p className="text-xl opacity-85">Guest</p>
    </Verdict>
  ),
});
