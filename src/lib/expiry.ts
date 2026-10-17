const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+01:00, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function toLagosShifted(d: Date): Date {
  return new Date(d.getTime() + LAGOS_OFFSET_MS);
}

function lagosEndOfDay(lagosShifted: Date, addDays: number): Date {
  const year = lagosShifted.getUTCFullYear();
  const month = lagosShifted.getUTCMonth();
  const date = lagosShifted.getUTCDate() + addDays;
  // 23:59 Lagos time is 22:59 UTC
  return new Date(Date.UTC(year, month, date, 22, 59, 0, 0));
}

export function computeExpiry(option: string, now: Date, picked?: string): Date {
  if (option === "Next 2 hours") {
    return new Date(now.getTime() + 2 * 60 * 60 * 1000);
  }

  const lagosNow = toLagosShifted(now);

  if (option === "Today") {
    return lagosEndOfDay(lagosNow, 0);
  }

  if (option === "Tomorrow") {
    return lagosEndOfDay(lagosNow, 1);
  }

  if (option === "This weekend") {
    const dayOfWeek = lagosNow.getUTCDay(); // 0 = Sunday
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    return lagosEndOfDay(lagosNow, daysUntilSunday);
  }

  if (option === "Pick date and time") {
    if (!picked || !picked.trim()) return new Date(NaN);
    const trimmed = picked.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}:00+01:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}+01:00`);
    }
    return new Date(trimmed);
  }

  return lagosEndOfDay(lagosNow, 0);
}

export function formatUntil(validTo: Date | string, now: Date = new Date()): string {
  const validDate = typeof validTo === "string" ? new Date(validTo) : validTo;
  const lagosValid = toLagosShifted(validDate);
  const lagosNow = toLagosShifted(now);

  const validDayStart = Date.UTC(
    lagosValid.getUTCFullYear(),
    lagosValid.getUTCMonth(),
    lagosValid.getUTCDate(),
  );
  const nowDayStart = Date.UTC(
    lagosNow.getUTCFullYear(),
    lagosNow.getUTCMonth(),
    lagosNow.getUTCDate(),
  );

  const diffDays = Math.round((validDayStart - nowDayStart) / DAY_MS);

  const hours24 = lagosValid.getUTCHours();
  const minutes = String(lagosValid.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  const timeStr = `${hours12}:${minutes} ${period}`;

  if (diffDays === 0) {
    return `Until today, ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Until tomorrow, ${timeStr}`;
  }

  const dayName = DAYS[lagosValid.getUTCDay()];
  const dayNum = lagosValid.getUTCDate();
  const monthName = MONTHS[lagosValid.getUTCMonth()];
  return `Until ${dayName} ${dayNum} ${monthName}, ${timeStr}`;
}

export function formatCode(code: string): string {
  const clean = code.replace(/\s+/g, "");
  return clean.length === 6 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : code;
}

/** "Sat 25 Oct" in Lagos time. */
export function lagosDay(value: Date | string): string {
  const d = toLagosShifted(typeof value === "string" ? new Date(value) : value);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Today's date in Lagos as "YYYY-MM-DD" (for date inputs), optionally shifted by whole days. */
export function lagosDateInput(now: Date = new Date(), addDays = 0): string {
  const d = toLagosShifted(new Date(now.getTime() + addDays * DAY_MS));
  return d.toISOString().slice(0, 10);
}

/** Start of a "YYYY-MM-DD" day in Lagos (00:00), or `now` if that day is today. */
export function lagosStartOf(dateStr: string, now: Date = new Date()): Date {
  const start = new Date(`${dateStr}T00:00:00+01:00`);
  return start.getTime() < now.getTime() ? now : start;
}

/** End of a "YYYY-MM-DD" day in Lagos (23:59). */
export function lagosEndOf(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:00+01:00`);
}

type Validity = { type?: string | null | undefined; valid_from?: string | null | undefined; valid_to: string };

/** How long a code works, in words. Long Stay codes that start later show the date range. */
export function formatValidity(c: Validity, now: Date = new Date()): string {
  if (c.type === "long_stay" && c.valid_from && new Date(c.valid_from).getTime() > now.getTime()) {
    return `From ${lagosDay(c.valid_from)} ${formatUntil(c.valid_to, now).replace(/^Until /, "until ")}`;
  }
  return formatUntil(c.valid_to, now);
}

const COMMUNITY_NOTE =
  "🕌 Lighthouse Estate is a Muslim residential community. Residents and visitors are kindly expected to uphold its values and peaceful environment. Alcohol, indecent dressing and loud music are strictly prohibited.";

/** The full gate message a visitor or staff member receives. `whenLine` is the time line (or working hours). */
export function gateMessage(p: { code: string; hostName?: string | null | undefined; houseNumber: string; unitLabel: string; whenLine: string; extra?: string }): string {
  const host = p.hostName ? `${p.hostName}, House ${p.houseNumber} · ${p.unitLabel}` : `House ${p.houseNumber} · ${p.unitLabel}`;
  return [
    "Assalam Alaekum Waramotullahi Wabarakatu,",
    "",
    "Welcome to Lighthouse Estate Lekki.",
    "",
    "Your gate access details:",
    `🔑 Access code: ${formatCode(p.code)}`,
    `🏠 Host: ${host}`,
    `⏱️ ${p.whenLine}`,
    ...(p.extra ? [p.extra] : []),
    "",
    "Please show this code to estate security at the gate.",
    "If you need any assistance, kindly contact your host directly.",
    "",
    COMMUNITY_NOTE,
    "",
    "Thank you for your understanding and cooperation.",
  ].join("\n");
}

export async function shareText(message: string): Promise<void> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text: message });
    } catch {
      // User cancelled the share sheet; do nothing
    }
  } else if (typeof window !== "undefined") {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
}

export async function shareAccessCode(params: {
  code: string;
  validTo: Date | string;
  houseNumber: string;
  unitLabel: string;
  hostName?: string | null | undefined;
  type?: string | null | undefined;
  validFrom?: string | null | undefined;
}): Promise<void> {
  const validTo = typeof params.validTo === "string" ? params.validTo : params.validTo.toISOString();
  const when = formatValidity({ type: params.type, valid_from: params.validFrom, valid_to: validTo });
  const whenLine = when.startsWith("From ") ? `Valid ${when.charAt(0).toLowerCase()}${when.slice(1)}` : `Valid until: ${when.replace(/^Until\s+/i, "")}`;
  const message = gateMessage({
    code: params.code, hostName: params.hostName, houseNumber: params.houseNumber, unitLabel: params.unitLabel, whenLine,
    ...(params.type === "long_stay" ? { extra: "You can come and go as often as you need until then." } : {}),
  });
  return shareText(message);
}

