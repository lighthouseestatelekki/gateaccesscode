
import { Verdict } from "@/components/lh/guard";

export const title = "Denied";

export default function Page() {
  return (
    <Verdict tone="denied" title="DENIED">
      <p className="text-2xl font-semibold">Code not recognised</p>
    </Verdict>
  );
}
