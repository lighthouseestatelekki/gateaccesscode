import { shareText } from "@/lib/expiry";

export const ID_TYPES = ["NIN", "Driver's licence", "Voter's card", "Passport", "Other"] as const;

export type Onboarding = "none" | "invited" | "submitted" | "done";

export type StaffDetails = {
  id: string;
  full_name: string;
  phone: string | null;
  job_title: string;
  approved_at: string | null;
  onboarding: Onboarding;
  invite_expires_at: string | null;
  review_note: string | null;
  photo: string | null;
  id_type: string | null;
  id_last4: string | null;
  kin_kind: "next_of_kin" | "guarantor" | null;
  kin_name: string | null;
  kin_phone: string | null;
  kin_relation: string | null;
  submitted_at: string | null;
};

export const STAFF_COLUMNS =
  "id,full_name,phone,job_title,approved_at,onboarding,invite_expires_at,review_note,photo,id_type,id_last4,kin_kind,kin_name,kin_phone,kin_relation,submitted_at";

export function inviteUrl(token: string, origin = window.location.origin): string {
  return `${origin}/join/${token}`;
}

export function kinLabel(k: string | null): string {
  return k === "guarantor" ? "Guarantor" : "Next of kin";
}

/** WhatsApp message with the staff member's private link. No resident phone number, for privacy. */
export function shareStaffInvite(p: { token: string; staffName: string; house: string; unit: string }) {
  const first = p.staffName.trim().split(/\s+/)[0] ?? p.staffName;
  const msg = [
    `Assalam Alaekum ${first},`,
    "",
    `Please complete your staff registration for House ${p.house} · ${p.unit}, Light House Estate, Lekki:`,
    inviteUrl(p.token),
    "",
    "You will need: a clear photo of your face, your ID card, and the phone number of your next of kin or guarantor.",
    "The link works for 7 days. Your gate code will work once the house approves you.",
  ].join("\n");
  return shareText(msg);
}
