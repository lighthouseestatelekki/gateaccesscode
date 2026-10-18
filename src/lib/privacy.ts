// The privacy notice. DRAFT for the estate's lawyer to review: it is not legal advice.
// Raise PRIVACY_VERSION whenever the wording changes in a way people should agree to again.

export const PRIVACY_VERSION = 1;
export const PRIVACY_UPDATED = "18 October 2026";

/** Filled in by the estate before launch. Shown as-is until then. */
export const CONTROLLER = "Light House Estate, Lekki (the Estate)";
export const PRIVACY_CONTACT = "[privacy contact email, to be confirmed]";

export const PRIVACY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      `${CONTROLLER} runs this app to manage gate access and security for residents. We are responsible for the personal data in it under the Nigeria Data Protection Act 2023.`,
      `Questions or requests: ${PRIVACY_CONTACT}, or speak to the Estate Manager.`,
    ],
  },
  {
    title: "What we collect",
    body: [
      "Residents and household members: name, phone, email, house and unit, next of kin, and when you approve or create things in the app. Your PIN is stored scrambled; nobody can read it.",
      "Visitors: the name you give for each access code, and when the code was used at the gate.",
      "Household staff: name, phone, job, working hours, a face photo, ID type and its last 4 digits, and a next of kin or guarantor, all given by the staff member with their consent.",
      "Guards: name, phone, guard number, shift times and incident reports.",
      "Gate log: every code checked at the gate, the time, and whether entry was allowed.",
      "Fix-It requests and photos you send, SOS alerts, and alerts sent to you.",
    ],
  },
  {
    title: "Why we use it",
    body: [
      "To let the right people in and keep others out, to alert you when visitors arrive, to respond to emergencies, to investigate security incidents, and to send estate notices.",
      "We rely on the Estate's legitimate interest in keeping residents safe, on your membership of the estate, and, for staff photos and ID, on the staff member's consent.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "You see your own household's information. Guards see only what they need at the gate (a visitor's name and house, or a staff member's photo and ID ending). The Estate Manager sees what is needed to run the estate. Every action the Estate Manager takes is recorded in a history that cannot be edited.",
      "We do not sell your data or use it for advertising. Our service providers store it for us: Supabase (database and sign-in), Cloudflare (hosting the app) and Brevo (email alerts). Some of them store data outside Nigeria, with safeguards in their contracts.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "Gate log, visitor codes, incident reports, guard shifts and the Estate Manager's action history: 24 months.",
      "Alerts in your inbox: 12 months.",
      "When a household moves out, or a person is removed: their personal details are deleted after 90 days.",
      "Staff photo, ID and next of kin: deleted as soon as the staff member is removed.",
      "Backup copies: kept for 30 days, encrypted.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can ask to see your data (use More → Download my data), correct it, delete it (moving out removes it), or object to how it is used. You can withdraw consent for staff details by asking the house to remove you.",
      "If you are not happy with how we handle your data, you can complain to the Nigeria Data Protection Commission (NDPC).",
    ],
  },
  {
    title: "Keeping it safe",
    body: [
      "PINs are scrambled, the Estate Manager uses a second sign-in step, phones lock after inactivity, and you can sign out of every device. Access to data is limited by role.",
    ],
  },
];
