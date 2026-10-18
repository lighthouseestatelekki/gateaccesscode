export const INCIDENT_TYPES = [
  ["suspicious", "Suspicious person"],
  ["theft", "Theft"],
  ["damage", "Damage"],
  ["disturbance", "Fight or disturbance"],
  ["vehicle", "Vehicle problem"],
  ["fire_hazard", "Fire or hazard"],
  ["other", "Other"],
] as const;

export function incidentLabel(k: string): string {
  return INCIDENT_TYPES.find(([v]) => v === k)?.[1] ?? k;
}

export type Incident = {
  id: string;
  ref: number;
  reported_by: string;
  gate: number | null;
  category: string;
  description: string;
  house_number: string | null;
  house_unit: string | null;
  photo: string | null;
  status: "open" | "closed";
  manager_note: string | null;
  created_at: string;
  closed_at: string | null;
};
