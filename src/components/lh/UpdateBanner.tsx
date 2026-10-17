import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useUpdateReady } from "@/lib/updates";

/** "New version ready" — one tap reloads into the latest app. */
export function UpdateBanner() {
  const ready = useUpdateReady();
  const [later, setLater] = useState(false);
  if (!ready || later) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl bg-deep px-4 py-3 text-deep-foreground shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)]">
      <RefreshCw className="size-5 shrink-0 text-gold" />
      <p className="flex-1 text-sm font-semibold">A new version of the app is ready</p>
      <button onClick={() => window.location.reload()} className="min-h-10 shrink-0 rounded-full bg-gold px-4 text-sm font-bold text-deep-dark">Refresh</button>
      <button aria-label="Later" onClick={() => setLater(true)} className="-mr-1 flex size-9 shrink-0 items-center justify-center text-deep-foreground/70"><X className="size-4" /></button>
    </div>
  );
}
