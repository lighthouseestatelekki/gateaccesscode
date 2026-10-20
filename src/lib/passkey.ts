// Fingerprint / Face ID sign-in ("passkeys"). The phone keeps a private key that only its owner's
// fingerprint or face can unlock; the server keeps the public key. Nothing about the fingerprint
// itself ever leaves the phone.
import { supabase } from "@/lib/supabase";

const FLAG = "lh.passkey"; // set on this phone once fingerprint sign-in is turned on here

type Json = Record<string, unknown>;

const b64uToBuf = (s: string): ArrayBuffer => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u.buffer;
};
const bufToB64u = (buf: ArrayBuffer | null): string | undefined => {
  if (!buf) return undefined;
  let s = "";
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Can this phone/browser do fingerprint sign-in at all? */
export async function passkeySupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export const passkeyOnThisPhone = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};
export const setPasskeyOnThisPhone = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
};

async function call<T = Json>(body: Json): Promise<T> {
  const { data, error } = await supabase.functions.invoke("passkey", { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    try {
      const j = ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch {
      /* keep message */
    }
    if (/failed to send a request|failed to fetch|not found/i.test(msg)) msg = "Fingerprint sign-in is not available yet. Please use your PIN for now.";
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data) throw new Error(String((data as Json)["error"]));
  return data as T;
}

/** Turns the browser's "cancelled / not allowed" into a friendly message. */
function friendly(e: unknown): Error {
  const err = e as Error;
  if (err?.name === "NotAllowedError" || err?.name === "AbortError") return new Error("The fingerprint check was cancelled. Try again, or use your PIN.");
  if (err?.name === "InvalidStateError") return new Error("This phone is already set up for fingerprint sign-in.");
  if (err?.name === "NotSupportedError" || err?.name === "SecurityError") return new Error("This phone can't use fingerprint sign-in. Please use your PIN.");
  return err instanceof Error ? err : new Error(String(e));
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android [\d.]+; ([^;)]+)/);
    return m?.[1] && !/^K$/.test(m[1]) ? m[1].trim().slice(0, 40) : "Android phone";
  }
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows computer";
  return "This device";
}

/** Adds fingerprint sign-in for the signed-in person on this phone. */
export async function registerPasskey(): Promise<void> {
  const { options, challenge_id } = await call<{ options: Json; challenge_id: string }>({ action: "register_options" });
  const o = options as {
    challenge: string; rp: { id: string; name: string }; user: { id: string; name: string; displayName: string };
    pubKeyCredParams: PublicKeyCredentialParameters[]; timeout?: number; excludeCredentials?: { id: string; transports?: AuthenticatorTransport[] }[];
    authenticatorSelection?: AuthenticatorSelectionCriteria; attestation?: AttestationConveyancePreference;
  };
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge: b64uToBuf(o.challenge),
        rp: o.rp,
        user: { id: b64uToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName },
        pubKeyCredParams: o.pubKeyCredParams,
        ...(o.timeout ? { timeout: o.timeout } : {}),
        excludeCredentials: (o.excludeCredentials ?? []).map((c) => ({ type: "public-key" as const, id: b64uToBuf(c.id), ...(c.transports ? { transports: c.transports } : {}) })),
        ...(o.authenticatorSelection ? { authenticatorSelection: o.authenticatorSelection } : {}),
        attestation: o.attestation ?? "none",
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  const r = cred.response as AuthenticatorAttestationResponse;
  const response = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    response: {
      clientDataJSON: bufToB64u(r.clientDataJSON),
      attestationObject: bufToB64u(r.attestationObject),
      transports: r.getTransports?.() ?? [],
    },
  };
  await call({ action: "register_verify", challenge_id, response, device_name: deviceName() });
  setPasskeyOnThisPhone(true);
}

async function assert(options: Json): Promise<Json> {
  const o = options as { challenge: string; rpId?: string; timeout?: number; allowCredentials?: { id: string; transports?: AuthenticatorTransport[] }[]; userVerification?: UserVerificationRequirement };
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: b64uToBuf(o.challenge),
        ...(o.rpId ? { rpId: o.rpId } : {}),
        ...(o.timeout ? { timeout: o.timeout } : {}),
        userVerification: o.userVerification ?? "required",
        allowCredentials: (o.allowCredentials ?? []).map((c) => ({ type: "public-key" as const, id: b64uToBuf(c.id), ...(c.transports ? { transports: c.transports } : {}) })),
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    response: {
      clientDataJSON: bufToB64u(r.clientDataJSON),
      authenticatorData: bufToB64u(r.authenticatorData),
      signature: bufToB64u(r.signature),
      userHandle: bufToB64u(r.userHandle),
    },
  };
}

/** Signs in with the fingerprint. Returns the person's role. */
export async function signInWithPasskey(): Promise<string> {
  const { options, challenge_id } = await call<{ options: Json; challenge_id: string }>({ action: "login_options" });
  const response = await assert(options);
  const r = await call<{ access_token: string; refresh_token: string; role: string }>({ action: "login_verify", challenge_id, response });
  const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
  if (error) throw new Error(error.message);
  setPasskeyOnThisPhone(true);
  return r.role;
}

/** App lock: confirms it's still the signed-in person (no new sign-in). */
export async function confirmWithPasskey(): Promise<void> {
  const { options, challenge_id } = await call<{ options: Json; challenge_id: string }>({ action: "verify_options" });
  const response = await assert(options);
  await call({ action: "verify_check", challenge_id, response });
}

export type PasskeyRow = { id: string; device_name: string | null; created_at: string; last_used_at: string | null };

export async function myPasskeys(userId: string): Promise<PasskeyRow[]> {
  const { data } = await supabase.from("passkeys").select("id,device_name,created_at,last_used_at").eq("user_id", userId).order("created_at");
  return (data as PasskeyRow[]) ?? [];
}

export async function removePasskey(id: string): Promise<void> {
  const { error } = await supabase.rpc("remove_passkey", { p_id: id });
  if (error) throw new Error(error.message);
}
