const LAGOS = 60 * 60 * 1000;
const DAY = 24 * LAGOS;

function dayStart(d: Date) {
  const s = new Date(d.getTime() + LAGOS);
  return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
}

/** "Today, 9:12 AM" / "Yesterday, 5:05 PM" / "12 Oct, 10:00 AM" in Lagos time. */
export function formatWhen(value: string | Date, now: Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const s = new Date(d.getTime() + LAGOS);
  const h = s.getUTCHours();
  const time = `${h % 12 || 12}:${String(s.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  const diff = Math.round((dayStart(now) - dayStart(d)) / DAY);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${s.getUTCDate()} ${months[s.getUTCMonth()]}, ${time}`;
}
