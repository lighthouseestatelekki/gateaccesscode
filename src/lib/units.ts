export const UNIT_CODES: Record<string, string> = {
  "Main house": "main",
  "Ground floor flat": "ground",
  "Upper floor flat": "upper",
  "Guest chalet": "chalet",
  "Boys' quarters": "boys",
};

export const CODE_UNITS: Record<string, string> = {
  main: "Main house",
  ground: "Ground floor flat",
  upper: "Upper floor flat",
  chalet: "Guest chalet",
  boys: "Boys' quarters",
};

export function unitToCode(unit: string): string {
  return UNIT_CODES[unit] ?? unit;
}

export function codeToUnit(code: string): string {
  return CODE_UNITS[code] ?? code;
}
