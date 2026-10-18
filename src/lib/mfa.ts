import { supabase } from "@/lib/supabase";

// Two-step sign-in for the Estate Manager: password, then a 6-digit code from an authenticator app
// (Google Authenticator, Microsoft Authenticator, Authy...). Uses Supabase's built-in TOTP support.

export type MfaState = "verified" | "needs_code" | "needs_setup";

export async function mfaState(): Promise<MfaState> {
  const mfa = supabase.auth.mfa;
  if (!mfa) return "verified"; // (only in tests)
  const { data } = await mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return "verified";
  if (data?.nextLevel === "aal2") return "needs_code";
  return "needs_setup";
}

async function verifiedFactorId(): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === "verified")?.id ?? null;
}

/** Checks the 6-digit code for an already set-up authenticator. */
export async function verifyCode(code: string): Promise<void> {
  const id = await verifiedFactorId();
  if (!id) throw new Error("No authenticator is set up for this account.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "That code is not right, or it has changed. Please try the latest code." : error.message);
}

/** Starts setting up an authenticator: returns a QR picture to scan and the key to type in by hand. */
export async function startSetup(): Promise<{ factorId: string; qr: string; secret: string }> {
  // Clear any half-finished set-up from an earlier attempt.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Light House Estate ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) throw new Error(error?.message ?? "Could not start the set-up.");
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finishes set-up with the first code the app shows. */
export async function finishSetup(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "That code is not right. Check the time on your phone and try the latest code." : error.message);
}
