// Prayer times for Lekki, worked out on the phone (no internet needed).
// Method: Egyptian General Authority of Survey (Fajr 19.5°, Isha 17.5°), the usual default for Nigeria,
// Asr by the standard (Shafi'i) shadow rule,
// Maghrib at sunset. Small safety margins are added, as printed timetables do.
// Times can differ by a minute or two from a local mosque's timetable.

export const LEKKI = { lat: 6.45, lng: 3.5, tz: 1 };
const FAJR_ANGLE = 19.5;
const ISHA_ANGLE = 17.5;
// Minutes added after the astronomical moment (precaution), per prayer.
const ADJUST = { fajr: 1, sunrise: -1, dhuhr: 2, asr: 1, maghrib: 2, isha: 1 };

export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type PrayerName = (typeof PRAYERS)[number];
export type PrayerDay = { date: Date; times: Record<PrayerName | "Sunrise", Date> };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

/** Sun declination and equation of time for a Julian date. */
function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  return { decl, eqt };
}

function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** Prayer times for the given Lagos calendar day (y, m 1-12, d). */
export function prayerTimes(y: number, m: number, d: number, loc = LEKKI): PrayerDay {
  const jd = julian(y, m, d) - loc.lng / 360;
  const at = (hours: number) => sunPosition(jd + hours / 24);
  const noon = (h: number) => fix(12 - at(h).eqt, 24);
  // hour angle (in hours) when the sun is `angle` degrees below/above the horizon
  const ha = (angle: number, h: number) => {
    const { decl } = at(h);
    const v = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(loc.lat))) / (Math.cos(rad(decl)) * Math.cos(rad(loc.lat)));
    return deg(Math.acos(Math.min(1, Math.max(-1, v)))) / 15;
  };
  const asrHa = (h: number) => {
    const { decl } = at(h);
    const angle = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(loc.lat - decl))))));
    return ha(angle, h);
  };
  // first guesses (local solar hours), then one refinement pass each
  const t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    t.fajr = noon(t.fajr) - ha(FAJR_ANGLE, t.fajr);
    t.sunrise = noon(t.sunrise) - ha(0.833, t.sunrise);
    t.dhuhr = noon(t.dhuhr);
    t.asr = noon(t.asr) + asrHa(t.asr);
    t.maghrib = noon(t.maghrib) + ha(0.833, t.maghrib);
    t.isha = noon(t.isha) + ha(ISHA_ANGLE, t.isha);
  }
  const shift = loc.tz - loc.lng / 15;
  const toDate = (hours: number, adjustMin: number) => {
    const local = hours + shift + adjustMin / 60; // Lagos clock hours
    const ms = Date.UTC(y, m - 1, d) + (local - loc.tz) * 3600_000;
    return new Date(Math.round(ms / 60_000) * 60_000);
  };
  return {
    date: new Date(Date.UTC(y, m - 1, d)),
    times: {
      Fajr: toDate(t.fajr, ADJUST.fajr),
      Sunrise: toDate(t.sunrise, ADJUST.sunrise),
      Dhuhr: toDate(t.dhuhr, ADJUST.dhuhr),
      Asr: toDate(t.asr, ADJUST.asr),
      Maghrib: toDate(t.maghrib, ADJUST.maghrib),
      Isha: toDate(t.isha, ADJUST.isha),
    },
  };
}

/** Today's Lagos date parts. */
export function lagosToday(now = new Date()) {
  const s = new Date(now.getTime() + 3600_000);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() };
}

/** The next prayer from now (rolls over to tomorrow's Fajr after Isha). */
export function nextPrayer(now = new Date()): { name: PrayerName; at: Date; today: PrayerDay } {
  const { y, m, d } = lagosToday(now);
  const today = prayerTimes(y, m, d);
  for (const p of PRAYERS) if (today.times[p].getTime() > now.getTime()) return { name: p, at: today.times[p], today };
  const tm = lagosToday(new Date(now.getTime() + 86_400_000));
  return { name: "Fajr", at: prayerTimes(tm.y, tm.m, tm.d).times.Fajr, today };
}

/** "5:12 AM" in Lagos time. */
export function clock(d: Date) {
  const s = new Date(d.getTime() + 3600_000);
  const h = s.getUTCHours();
  return `${h % 12 || 12}:${String(s.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah"];

/**
 * Islamic (Hijri) date, e.g. "9 Jumada al-Awwal 1448 AH". The local moon sighting can differ by a day.
 * Uses month NUMBERS from the phone and our own month names: some Android phones lack the Islamic
 * month names and would otherwise show Gregorian ones (e.g. "9 May 1448").
 */
export function hijriDate(now = new Date(), adjustDays = 0): string {
  const d = new Date(now.getTime() + adjustDays * 86_400_000);
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Africa/Lagos" }).formatToParts(d);
    const num = (t: string) => Number((parts.find((p) => p.type === t)?.value ?? "").replace(/[^0-9]/g, ""));
    const day = num("day");
    const month = HIJRI_MONTHS[num("month") - 1];
    const year = num("year");
    if (!day || !month || year < 1400 || year > 1600) return "";
    return `${day} ${month} ${year} AH`;
  } catch {
    return "";
  }
}
