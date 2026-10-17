import { createFileRoute } from "@tanstack/react-router";
import { meta, Verdict } from "@/components/lh/guard";

export const Route = createFileRoute("/guard/verdict/denied")({
  head: () => meta("Denied", "Visitor code not recognised."),
  component: () => (
    <Verdict tone="denied" title="DENIED">
      <p className="text-2xl font-semibold">Code not recognised</p>
    </Verdict>
  ),
});
