// Staff working schedules: days of the week (0 = Sunday … 6 = Saturday), hours, optional dates of the month.
export type Schedule = { days: number[] | null; start: string | null; end: string | null; dom: number[] | null };

export const ALWAYS: Schedule = { days: null, start: null, end: null, dom: null };
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "08:00:00" or "08:00" -> "8:00 AM" */
export function time12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${(h ?? 0) % 12 || 12}:${String(m ?? 0).padStart(2, "0")} ${(h ?? 0) >= 12 ? "PM" : "AM"}`;
}

function dayList(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  const ordered = DAY_ORDER.filter((d) => set.has(d));
  const key = ordered.join(",");
  if (key === "1,2,3,4,5") return "Mon–Fri";
  if (key === "1,2,3,4,5,6") return "Mon–Sat";
  if (key === "6,0") return "Weekends";
  // collapse runs, e.g. Mon–Wed, Fri
  const parts: string[] = [];
  let i = 0;
  while (i < ordered.length) {
    let j = i;
    while (j + 1 < ordered.length && DAY_ORDER.indexOf(ordered[j + 1]!) === DAY_ORDER.indexOf(ordered[j]!) + 1) j++;
    parts.push(j - i >= 2 ? `${DAY_SHORT[ordered[i]!]}–${DAY_SHORT[ordered[j]!]}` : ordered.slice(i, j + 1).map((d) => DAY_SHORT[d]).join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

/** Human summary, e.g. "Mon–Fri · 7:00 AM – 6:00 PM" or "Any day, any time". */
export function describeSchedule(s: Schedule): string {
  const bits: string[] = [];
  bits.push(s.days && s.days.length ? dayList(s.days) : "Any day");
  if (s.dom && s.dom.length) bits.push(`on the ${s.dom.slice().sort((a, b) => a - b).join(", ")} of the month`);
  bits.push(s.start && s.end ? `${time12(s.start)} – ${time12(s.end)}` : "any time");
  return bits.join(" · ");
}

export function fromRow(r: { days_of_week: number[] | null; start_time: string | null; end_time: string | null; days_of_month: number[] | null }): Schedule {
  return { days: r.days_of_week, start: r.start_time?.slice(0, 5) ?? null, end: r.end_time?.slice(0, 5) ?? null, dom: r.days_of_month };
}

export function toRpc(s: Schedule) {
  return { p_days: s.days, p_start: s.start, p_end: s.end, p_dom: s.dom };
}
