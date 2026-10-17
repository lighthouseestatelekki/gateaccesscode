import { useState } from "react";
import { cn } from "@/lib/utils";
import { DAY_ORDER, DAY_SHORT, type Schedule } from "@/lib/schedule";

const pill = (on: boolean) => cn("min-h-11 rounded-full px-3 text-sm font-semibold transition-colors", on ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2");
const input = "h-12 w-full rounded-2xl border-[1.5px] border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

/** Common working patterns, most common first. Picking one is a single tap. */
export const PRESETS: { key: string; label: string; hint: string; s: Schedule | null }[] = [
  { key: "weekdays", label: "Mon–Fri", hint: "7:00 AM – 6:00 PM", s: { days: [1, 2, 3, 4, 5], start: "07:00", end: "18:00", dom: null } },
  { key: "mon-sat", label: "Mon–Sat", hint: "7:00 AM – 6:00 PM", s: { days: [1, 2, 3, 4, 5, 6], start: "07:00", end: "18:00", dom: null } },
  { key: "always", label: "Any time", hint: "Every day, day or night", s: { days: null, start: null, end: null, dom: null } },
  { key: "custom", label: "Custom", hint: "Choose days and hours", s: null },
];
export const DEFAULT_SCHEDULE: Schedule = PRESETS[0]!.s!;
const sameSchedule = (a: Schedule, b: Schedule) => JSON.stringify(a) === JSON.stringify(b);

/** Pick when a staff code works: any time, or set days + hours (+ optional dates of the month). */
export function ScheduleEditor({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const [custom, setCustom] = useState(() => !PRESETS.some((p) => p.s && sameSchedule(value, p.s)));
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
      <div role="radiogroup" aria-label="When can they come in?" className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => {
          const on = p.key === "custom" ? custom : sameSchedule(value, p.s!) && !custom;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { setCustom(p.key === "custom"); if (p.s) onChange(p.s); else if (!limited) onChange(PRESETS[0]!.s!); }}
              className={cn("flex min-h-14 flex-col items-start justify-center rounded-2xl border-[1.5px] px-3 py-1.5 text-left", on ? "border-primary bg-mint-lightest text-deep" : "border-border bg-card")}
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.hint}</span>
            </button>
          );
        })}
      </div>
      {custom && (
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
