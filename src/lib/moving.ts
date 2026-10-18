export type MoveOut = {
  id: string;
  house_number: string;
  house_unit: string;
  resident_id: string;
  move_date: string; // YYYY-MM-DD
  note: string | null;
  status: "requested" | "confirmed" | "done" | "cancelled";
  requested_by: string;
  confirmed_by: string | null;
  created_at: string;
  done_at: string | null;
};

export function formatMoveDate(d: string): string {
  return new Date(`${d}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

export function moveStatusLabel(s: MoveOut["status"]): string {
  return { requested: "Waiting for the Estate Manager", confirmed: "Confirmed", done: "Done", cancelled: "Cancelled" }[s];
}
