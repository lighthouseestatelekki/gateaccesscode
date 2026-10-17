
import { Verdict } from "@/components/lh/guard";

export const title = "Expired";

export default function Page() {
  return (
    <Verdict tone="expired" title="EXPIRED">
      <p className="text-2xl font-semibold">Guest code already used</p>
    </Verdict>
  );
}
