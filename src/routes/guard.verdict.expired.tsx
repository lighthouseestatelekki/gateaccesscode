import { createFileRoute } from "@tanstack/react-router";
import { meta, Verdict } from "@/components/lh/guard";

export const Route = createFileRoute("/guard/verdict/expired")({
  head: () => meta("Expired", "Visitor code has expired."),
  component: () => (
    <Verdict tone="expired" title="EXPIRED">
      <p className="text-2xl font-semibold">Guest code already used</p>
    </Verdict>
  ),
});
