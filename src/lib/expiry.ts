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

export async function shareAccessCode(params: {
  code: string;
  validTo: Date | string;
  houseNumber: string;
  unitLabel: string;
}): Promise<void> {
  const formattedCode = formatCode(params.code);
  const untilPart = formatUntil(params.validTo).replace(/^Until\s+/i, "");
  const message = `Assalam Alaekum. Your access code for Lighthouse Estate Lekki is ${formattedCode}. Valid until ${untilPart}. Visiting House ${params.houseNumber} · ${params.unitLabel}. Please show this code to the guard at the gate.`;

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
