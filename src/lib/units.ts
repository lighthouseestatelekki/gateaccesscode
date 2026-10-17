/** What residents see, in order. The saved codes (main/ground/upper/boys) never change. */
export const UNIT_LABELS = ["Duplex", "Ground Floor", "First Floor", "BQ"] as const;

export const CODE_UNITS: Record<string, string> = {
  main: "Duplex",
  ground: "Ground Floor",
  upper: "First Floor",
  boys: "BQ",
  chalet: "Guest chalet", // not offered any more; kept so any old row still reads sensibly
};

export const UNIT_CODES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CODE_UNITS).map(([c, l]) => [l, c])),
  // Old labels, so phones that remembered "Main house" before the rename still sign in.
  "Main house": "main",
  "Ground floor flat": "ground",
  "Upper floor flat": "upper",
  "Boys' quarters": "boys",
};

export function unitToCode(unit: string): string {
  return UNIT_CODES[unit] ?? unit;
}

export function codeToUnit(code: string): string {
  return CODE_UNITS[code] ?? code;
}
