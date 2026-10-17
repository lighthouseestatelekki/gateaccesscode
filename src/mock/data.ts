export const UNITS = ["Main house", "Ground floor flat", "Upper floor flat", "Guest chalet", "Boys' quarters"] as const;

export const resident = { firstName: "Aisha", fullName: "Aisha Bello", house: "14", unit: "Main house" };

export type CodeStatus = "Active" | "Used" | "Expired";
export const codes: { code: string; visitor: string; status: CodeStatus; expiry: string }[] = [
  { code: "184 302", visitor: "Ibrahim Yusuf", status: "Active", expiry: "Today, 6:00 PM" },
  { code: "529 117", visitor: "Fatima Ade", status: "Used", expiry: "Yesterday, 8:00 PM" },
  { code: "730 846", visitor: "Musa Okon", status: "Expired", expiry: "12 Oct, 10:00 AM" },
];

export const recentVisitors = ["Ibrahim", "Fatima", "Musa", "Zainab"];

export const pending = [
  { id: 1, name: "Abdullahi Sani", house: "14", unit: "Main house", submitted: "Today, 9:12 AM", phone: "0803 555 0142", email: "abdullahi@example.com", kin: { name: "Hauwa Sani", phone: "0806 555 0191", relationship: "Wife" } },
  { id: 2, name: "Maryam Lawal", house: "22", unit: "Upper floor flat", submitted: "Today, 7:40 AM" },
  { id: 3, name: "Usman Bakare", house: "9", unit: "Guest chalet", submitted: "Yesterday, 5:05 PM" },
];

export const residents = [
  { name: "Aisha Bello", house: "14", unit: "Main house", phone: "0802 555 0110" },
  { name: "Kabir Hassan", house: "31", unit: "Ground floor flat", phone: "0809 555 0177" },
];

export const guards = [
  { number: "7", name: "Sule Danjuma", gate: "Gate 1", status: "Active" },
  { number: "3", name: "Emeka Obi", gate: "Gate 1", status: "Active" },
];

export const managerStats = { codesToday: 23, insideNow: 8 };
