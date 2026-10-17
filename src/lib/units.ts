export const UNIT_CODES: Record<string, string> = {
  "Main house": "main",
  "Ground floor flat": "ground",
  "Upper floor flat": "upper",
  "Guest chalet": "chalet",
  "Boys' quarters": "boys",
};

export function unitToCode(unit: string): string {
  return UNIT_CODES[unit] ?? unit;
}
