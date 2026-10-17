import { Check, MapPin } from "lucide-react";
import { categoryOf, STATUS_CHIP, STATUS_LABEL, type Fixit } from "@/lib/fixit";
import { codeToUnit } from "@/lib/units";
import { formatWhen } from "@/lib/when";
import { cn } from "@/lib/utils";

const STEPS = ["open", "in_progress", "done"] as const;

/** One Fix-It request: what, where, photo, and how far along it is. */
export function FixitCard({ r, photo, showHouse, children }: { r: Fixit; photo?: string | undefined; showHouse?: boolean; children?: React.ReactNode }) {
  const cat = categoryOf(r.category);
  const Icon = cat.icon;
  const at = STEPS.indexOf(r.status);
  return (
    <li className="overflow-hidden rounded-[22px] border border-border bg-card">
      <div className="flex gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-light text-deep"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{cat.label} <span className="font-normal text-muted-foreground">#{r.ref}</span></p>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_CHIP[r.status])}>{STATUS_LABEL[r.status]}</span>
          </div>
          {showHouse && <p className="text-sm font-medium text-text-2">House {r.house_number} · {codeToUnit(r.house_unit)} · {r.full_name}</p>}
          <p className="mt-1 whitespace-pre-line text-[15px]">{r.description}</p>
          {r.location && <p className="mt-1 flex items-center gap-1 text-sm text-text-2"><MapPin className="size-3.5" />{r.location}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Reported {formatWhen(r.created_at)}</p>
        </div>
      </div>
      {photo && (
        <a href={photo} target="_blank" rel="noreferrer" className="block px-4 pb-3">
          <img src={photo} alt={`Photo for request ${r.ref}`} className="h-40 w-full rounded-2xl object-cover" />
        </a>
      )}
      <div className="px-4 pb-4">
        <ol className="flex items-center gap-1.5" aria-label={`Progress: ${STATUS_LABEL[r.status]}`}>
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1.5">
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", i <= at ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {i < at || r.status === "done" ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn("text-xs font-semibold", i <= at ? "text-deep" : "text-muted-foreground")}>{STATUS_LABEL[s]}</span>
              {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", i < at ? "bg-primary" : "bg-border")} />}
            </li>
          ))}
        </ol>
        {r.manager_note && <p className="mt-3 rounded-2xl bg-mint-lightest px-3 py-2 text-sm text-deep"><span className="font-semibold">Estate Manager:</span> {r.manager_note}</p>}
        {children}
      </div>
    </li>
  );
}
