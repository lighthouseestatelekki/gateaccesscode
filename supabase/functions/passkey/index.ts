// Supabase Edge Function: passkey  (fingerprint / Face ID sign-in)
// The phone keeps a private key that only unlocks with the owner's fingerprint or face; we keep the public key.
// Deploy with "Enforce JWT verification" OFF: signing in happens before there is a sign-in, so this
// function checks callers itself.
//
// Actions:
//   register_options / register_verify — signed-in: add this phone (residents and Estate Managers; not guards)
//   login_options / login_verify       — anyone: sign in with the fingerprint; returns a normal sign-in
//   verify_options / verify_check      — signed-in: confirm it's still you (app lock), no new sign-in
// Secrets: PASSKEY_ORIGINS (optional, comma-separated; default https://lighthouse-gatecode.pages.dev)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13.1.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@13.1.1/helpers";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const RP_NAME = "Light House Estate";

function claims(token: string): Record<string, unknown> {
  try {
    const t = token.split(".")[1] ?? "";
    return JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

/** The app's address must be one we expect; the fingerprint key is tied to it. */
function originOf(req: Request): string | null {
  const allowed = (Deno.env.get("PASSKEY_ORIGINS") ?? "https://lighthouse-gatecode.pages.dev").split(",").map((s) => s.trim()).filter(Boolean);
  const o = req.headers.get("origin") ?? "";
  return allowed.includes(o) ? o : null;
}

type Me = { id: string; role: string; status: string; full_name: string; house_number: string | null; house_unit: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);
  const origin = originOf(req);
  if (!origin) return reply({ error: "Fingerprint sign-in only works in the app itself." }, 403);
  const rpID = new URL(origin).hostname;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const fresh = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }
  const action = String(body.action ?? "");

  async function saveChallenge(challenge: string, purpose: "register" | "login", userId: string | null) {
    const { data, error } = await admin.from("passkey_challenges").insert({ challenge, purpose, user_id: userId }).select("id").single();
    if (error || !data) throw new Error("Could not start the fingerprint check. Please try again.");
    return data.id as string;
  }
  async function takeChallenge(id: unknown, purpose: string, userId: string | null) {
    const cid = String(id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(cid)) return null;
    const { data } = await admin.from("passkey_challenges").select("*").eq("id", cid).eq("purpose", purpose).maybeSingle();
    if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
    if (userId && data.user_id !== userId) return null;
    await admin.from("passkey_challenges").update({ used_at: new Date().toISOString() }).eq("id", cid);
    return data.challenge as string;
  }

  /** Checks a fingerprint answer against the stored key; returns the passkey row, or an error message. */
  async function checkAssertion(response: Record<string, unknown>, challenge: string) {
    const { data: key } = await admin.from("passkeys").select("*").eq("credential_id", String(response.id ?? "")).maybeSingle();
    if (!key) return { error: "This phone's fingerprint sign-in was removed. Please sign in with your PIN and turn it on again." };
    const v = await verifyAuthenticationResponse({
      // deno-lint-ignore no-explicit-any
      response: response as any,
      expectedChallenge: challenge,
      expectedOrigin: origin!,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: key.credential_id, publicKey: isoBase64URL.toBuffer(key.public_key), counter: Number(key.counter), transports: key.transports ?? undefined },
    }).catch((e: Error) => ({ verified: false, error: e.message }) as const);
    if (!v.verified || !("authenticationInfo" in v)) return { error: "The fingerprint check did not pass. Please try again or use your PIN." };
    await admin.from("passkeys").update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", key.id);
    return { key };
  }

  try {
    // =========================================================== sign in with the fingerprint
    if (action === "login_options") {
      const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: [], timeout: 60000 });
      const challenge_id = await saveChallenge(options.challenge, "login", null);
      return reply({ options, challenge_id });
    }

    if (action === "login_verify") {
      const challenge = await takeChallenge(body.challenge_id, "login", null);
      if (!challenge) return reply({ error: "That took too long. Please try again." }, 410);
      const r = await checkAssertion((body.response ?? {}) as Record<string, unknown>, challenge);
      if ("error" in r) return reply({ error: r.error }, 401);
      const { data: p } = await admin.from("profiles").select("id,role,status").eq("id", r.key.user_id).maybeSingle();
      if (!p || p.status !== "active") return reply({ error: "This account is not active. Please contact the Estate Manager." }, 403);
      if (p.role === "guard") return reply({ error: "Guards sign in with their PIN." }, 403);
      // Make a normal sign-in for this person without a password (a one-time link we use ourselves; no email is sent).
      const { data: u } = await admin.auth.admin.getUserById(p.id);
      const email = u?.user?.email;
      if (!email) return reply({ error: "Account not found." }, 404);
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkErr || !link?.properties?.hashed_token) return reply({ error: "Could not sign you in. Please use your PIN." }, 500);
      const { data: s, error: otpErr } = await fresh().auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
      if (otpErr || !s?.session) return reply({ error: "Could not sign you in. Please use your PIN." }, 500);
      const sid = String(claims(s.session.access_token).session_id ?? "");
      if (sid) await admin.from("strong_sessions").insert({ session_id: sid, user_id: p.id });
      return reply({ ok: true, role: p.role, access_token: s.session.access_token, refresh_token: s.session.refresh_token });
    }

    // =========================================================== signed-in actions
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: who } = await asCaller.auth.getUser();
    if (!who?.user) return reply({ error: "Please sign in again." }, 401);
    const { data: me } = await admin.from("profiles").select("id,role,status,full_name,house_number,house_unit").eq("id", who.user.id).maybeSingle() as { data: Me | null };
    if (!me || me.status !== "active") return reply({ error: "Your account is not active." }, 403);
    if (me.role === "guard") return reply({ error: "Guards sign in with their PIN." }, 403);
    const { data: role } = await asCaller.rpc("auth_role"); // null if this sign-in is too old, or a manager without the two-step

    if (action === "verify_options") {
      const { data: keys } = await admin.from("passkeys").select("credential_id,transports").eq("user_id", me.id);
      if (!keys?.length) return reply({ error: "No fingerprint sign-in on this account." }, 404);
      const options = await generateAuthenticationOptions({
        rpID, userVerification: "required", timeout: 60000,
        allowCredentials: keys.map((k) => ({ id: k.credential_id, transports: k.transports ?? undefined })),
      });
      return reply({ options, challenge_id: await saveChallenge(options.challenge, "login", me.id) });
    }
    if (action === "verify_check") {
      const challenge = await takeChallenge(body.challenge_id, "login", me.id);
      if (!challenge) return reply({ error: "That took too long. Please try again." }, 410);
      const r = await checkAssertion((body.response ?? {}) as Record<string, unknown>, challenge);
      if ("error" in r) return reply({ error: r.error }, 401);
      if (r.key.user_id !== me.id) return reply({ error: "That fingerprint belongs to another account." }, 403);
      if (me.role === "estate_manager" && !role) {
        // Password + this fingerprint = the two-step sign-in.
        const sid = String(claims(token).session_id ?? "");
        if (sid) await admin.from("strong_sessions").upsert({ session_id: sid, user_id: me.id });
      }
      return reply({ ok: true });
    }

    if (action === "register_options" || action === "register_verify") {
      if (!role) {
        // A manager signed in with only a password may add a fingerprint ONLY as their very first second step
        // (the same as setting up the authenticator app the first time).
        if (me.role !== "estate_manager") return reply({ error: "Please sign in again first." }, 401);
        const { data: f } = await admin.auth.admin.mfa.listFactors({ userId: me.id });
        const hasTotp = (f?.factors ?? []).some((x: { status: string }) => x.status === "verified");
        const { count } = await admin.from("passkeys").select("id", { count: "exact", head: true }).eq("user_id", me.id);
        if (hasTotp || (count ?? 0) > 0) return reply({ error: "Confirm your sign-in first (authenticator code or fingerprint), then add this phone." }, 403);
      }
      if (action === "register_options") {
        const { data: keys } = await admin.from("passkeys").select("credential_id,transports").eq("user_id", me.id);
        if ((keys?.length ?? 0) >= 10) return reply({ error: "You already have 10 phones set up. Remove one first." }, 409);
        const label = me.role === "estate_manager" ? `${me.full_name} (Estate Manager)` : `${me.full_name}, House ${me.house_number ?? ""}`;
        const options = await generateRegistrationOptions({
          rpName: RP_NAME, rpID,
          userID: new TextEncoder().encode(me.id),
          userName: label, userDisplayName: label,
          attestationType: "none", timeout: 60000,
          excludeCredentials: (keys ?? []).map((k) => ({ id: k.credential_id, transports: k.transports ?? undefined })),
          authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
        });
        return reply({ options, challenge_id: await saveChallenge(options.challenge, "register", me.id) });
      }
      const challenge = await takeChallenge(body.challenge_id, "register", me.id);
      if (!challenge) return reply({ error: "That took too long. Please try again." }, 410);
      const v = await verifyRegistrationResponse({
        // deno-lint-ignore no-explicit-any
        response: body.response as any,
        expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      }).catch((e: Error) => ({ verified: false, error: e.message }) as const);
      if (!v.verified || !("registrationInfo" in v) || !v.registrationInfo) return reply({ error: "This phone could not set up fingerprint sign-in." }, 400);
      const c = v.registrationInfo.credential;
      const { error } = await admin.from("passkeys").insert({
        user_id: me.id, credential_id: c.id, public_key: isoBase64URL.fromBuffer(c.publicKey), counter: c.counter,
        transports: c.transports ?? null, device_name: String(body.device_name ?? "").slice(0, 60) || null,
      });
      if (error) return reply({ error: /duplicate/i.test(error.message) ? "This phone is already set up." : error.message }, 400);
      const sid = String(claims(token).session_id ?? "");
      if (me.role === "estate_manager" && sid && !role) {
        // first-time set-up just now with a fingerprint: this sign-in now counts as two-step
        await admin.from("strong_sessions").insert({ session_id: sid, user_id: me.id });
      }
      await admin.from("audit_log").insert({ actor_id: me.id, actor_name: me.full_name, actor_role: me.role, action: "Turned on fingerprint sign-in", target: String(body.device_name ?? "a phone") });
      return reply({ ok: true });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error(e);
    return reply({ error: (e as Error).message }, 500);
  }
});
