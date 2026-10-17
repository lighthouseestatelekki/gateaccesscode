import { cn } from "@/lib/utils";
import { DAY_ORDER, DAY_SHORT, type Schedule } from "@/lib/schedule";

const pill = (on: boolean) => cn("min-h-11 rounded-full px-3 text-sm font-semibold transition-colors", on ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2");
const input = "h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

/** Pick when a staff code works: any time, or set days + hours (+ optional dates of the month). */
export function ScheduleEditor({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const limited = value.days !== null || value.start !== null || value.dom !== null;
  const days = value.days ?? [];
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    onChange({ ...value, days: next });
  };
  const toggleDom = (d: number) => {
    const cur = value.dom ?? [];
    onChange({ ...value, dom: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] });
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="When can they come in?" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
        <button role="radio" aria-checked={!limited} onClick={() => onChange({ days: null, start: null, end: null, dom: null })} className={cn("min-h-12 rounded-xl text-base font-semibold", !limited ? "bg-card text-deep shadow-sm" : "text-text-2")}>Any time</button>
        <button role="radio" aria-checked={limited} onClick={() => !limited && onChange({ days: [1, 2, 3, 4, 5], start: "07:00", end: "18:00", dom: null })} className={cn("min-h-12 rounded-xl text-base font-semibold", limited ? "bg-card text-deep shadow-sm" : "text-text-2")}>Set days & hours</button>
      </div>
      {limited && (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-text-2">Working days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_ORDER.map((d) => (
                <button key={d} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)} className={pill(days.includes(d))}>{DAY_SHORT[d]}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">From</span>
              <input type="time" value={value.start ?? ""} onChange={(e) => onChange({ ...value, start: e.target.value || null, end: value.end ?? "18:00" })} className={input} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-2">Until</span>
              <input type="time" value={value.end ?? ""} onChange={(e) => onChange({ ...value, end: e.target.value || null, start: value.start ?? "07:00" })} className={input} />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-text-2">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={value.dom !== null} onChange={(e) => onChange({ ...value, dom: e.target.checked ? [] : null })} />
            Only on certain dates of the month
          </label>
          {value.dom !== null && (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <button key={d} aria-pressed={value.dom!.includes(d)} onClick={() => toggleDom(d)} className={cn("h-10 rounded-lg text-sm font-semibold", value.dom!.includes(d) ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2")}>{d}</button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">If they are still inside when their hours end, they can always leave.</p>
        </>
      )}
    </div>
  );
}

/** Returns an error message, or "" if the schedule can be saved. */
export function scheduleProblem(s: Schedule): string {
  if (s.days !== null && s.days.length === 0) return "Choose at least one working day.";
  if (s.dom !== null && s.dom.length === 0) return "Choose at least one date of the month, or untick that option.";
  if ((s.start === null) !== (s.end === null)) return "Set both a start and an end time.";
  if (s.start && s.start === s.end) return "Start and end time cannot be the same.";
  return "";
}
