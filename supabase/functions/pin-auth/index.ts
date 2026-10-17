// Supabase Edge Function: pin-auth
// Every PIN-based action goes through here so we can (1) lock a login after repeated wrong PINs
// and (2) never store a bare 6-digit PIN as a password. The real password is a keyed hash of the
// PIN (secret PIN_PEPPER), so guessing PINs directly against Supabase Auth is useless.
//
// Actions:
//   register     — anyone: create a pending resident
//   login        — anyone: resident (house + unit + PIN) or guard (number + PIN); 5 wrong PINs = 15-minute lock
//   change_pin   — signed-in user: set a new PIN, clears "must change PIN"
//   create_guard — Estate Manager only
//   reset_pin    — Estate Manager only: temporary PIN for a resident or guard, clears any lock
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const UNITS = ["main", "ground", "upper", "chalet", "boys"];
const RES_DOMAIN = "residents.lighthouseestate.app";
const GUARD_DOMAIN = "guards.lighthouseestate.app";

export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  if (new Set(pin).size === 1) return true;
  if (pin.slice(0, 2).repeat(3) === pin) return true;
  const d = pin.split("").map(Number);
  const up = d.every((x, i) => i === 0 || x - d[i - 1] === 1);
  const down = d.every((x, i) => i === 0 || x - d[i - 1] === -1);
  return up || down;
}

function randomPin(): string {
  for (;;) {
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    if (!isWeakPin(pin)) return pin;
  }
}

async function pepper(pin: string, login: string): Promise<string> {
  const secret = Deno.env.get("PIN_PEPPER");
  if (!secret || secret.length < 20) throw new Error("Server is missing PIN_PEPPER (at least 20 characters).");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${login.toLowerCase()}:${pin}`));
  return "p1_" + Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

const cleanNumber = (v: unknown) => String(Number(String(v ?? "").trim()));
const residentLogin = (house: string, unit: string) => `house${house}-${unit}@${RES_DOMAIN}`;
const guardLogin = (num: string) => `guard${num}@${GUARD_DOMAIN}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const fresh = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }

  try {
    // ---------- register ----------
    if (body.action === "register") {
      const full_name = String(body.full_name ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const email = String(body.email ?? "").trim();
      const house = cleanNumber(body.house_number);
      const unit = String(body.house_unit ?? "");
      const nok_name = String(body.nok_name ?? "").trim();
      const nok_phone = String(body.nok_phone ?? "").trim();
      const nok_relationship = String(body.nok_relationship ?? "").trim();
      const pin = String(body.pin ?? "");
      if (full_name.length < 2 || phone.replace(/\D/g, "").length < 10 || !email.includes("@")) return reply({ error: "Please check your details." }, 400);
      if (!/^\d{1,3}$/.test(house) || house === "0" || !UNITS.includes(unit)) return reply({ error: "Please check your house number and unit." }, 400);
      if (!nok_name || !nok_phone || !nok_relationship) return reply({ error: "Please fill in your next of kin." }, 400);
      if (isWeakPin(pin)) return reply({ error: "That PIN is too easy to guess. Please choose another." }, 400);

      const login = residentLogin(house, unit);
      const { data: made, error: makeErr } = await admin.auth.admin.createUser({ email: login, password: await pepper(pin, login), email_confirm: true });
      if (makeErr || !made?.user) {
        if (/already/i.test(makeErr?.message ?? "")) {
          return reply({ error: "This house and unit is already registered. If this is you, log in. If not, please contact the Estate Manager." }, 409);
        }
        return reply({ error: makeErr?.message ?? "Could not register." }, 400);
      }
      const { error: profErr } = await admin.from("profiles").insert({
        id: made.user.id, role: "resident", status: "pending", full_name, phone, email,
        house_number: house, house_unit: unit, nok_name, nok_phone, nok_relationship,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(made.user.id);
        const dup = /one_resident_per_unit|duplicate/i.test(profErr.message);
        return reply({ error: dup ? "This house and unit is already registered. If this is you, log in. If not, please contact the Estate Manager." : profErr.message }, 400);
      }
      return reply({ ok: true });
    }

    // ---------- login ----------
    if (body.action === "login") {
      const kind = body.kind === "guard" ? "guard" : "resident";
      const pin = String(body.pin ?? "");
      let login: string;
      if (kind === "guard") {
        const num = cleanNumber(body.guard_number);
        if (!/^\d{1,4}$/.test(num) || num === "0") return reply({ error: "Enter your guard number and 6-digit PIN." }, 400);
        login = guardLogin(num);
      } else {
        const house = cleanNumber(body.house_number);
        const unit = String(body.house_unit ?? "");
        if (!/^\d{1,3}$/.test(house) || !UNITS.includes(unit)) return reply({ error: "Please choose your house again." }, 400);
        login = residentLogin(house, unit);
      }
      if (!/^\d{6}$/.test(pin)) return reply({ error: "Enter your 6-digit PIN." }, 400);

      const { data: att } = await admin.from("login_attempts").select("fails,locked_until").eq("login", login).maybeSingle();
      const now = Date.now();
      if (att?.locked_until && new Date(att.locked_until).getTime() > now) {
        const mins = Math.max(1, Math.ceil((new Date(att.locked_until).getTime() - now) / 60000));
        return reply({ error: `Too many wrong PINs. Please wait ${mins} minute${mins === 1 ? "" : "s"}, or ask the Estate Manager to reset your PIN.`, locked: true }, 423);
      }

      let session = (await fresh().auth.signInWithPassword({ email: login, password: await pepper(pin, login) })).data.session;
      if (!session) {
        // Accounts made before this change still have the bare PIN as password: accept once, then upgrade.
        const legacy = (await fresh().auth.signInWithPassword({ email: login, password: pin })).data.session;
        if (legacy) {
          await admin.auth.admin.updateUserById(legacy.user.id, { password: await pepper(pin, login) });
          session = legacy;
        }
      }

      if (!session) {
        const fails = (att?.locked_until && new Date(att.locked_until).getTime() <= now ? 0 : att?.fails ?? 0) + 1;
        const lock = fails >= MAX_FAILS;
        await admin.from("login_attempts").upsert({
          login,
          fails: lock ? 0 : fails,
          locked_until: lock ? new Date(now + LOCK_MINUTES * 60000).toISOString() : null,
          updated_at: new Date().toISOString(),
        });
        if (lock) {
          return reply({ error: `Too many wrong PINs. Please wait ${LOCK_MINUTES} minutes, or ask the Estate Manager to reset your PIN.`, locked: true }, 423);
        }
        const left = MAX_FAILS - fails;
        const what = kind === "guard" ? "Guard number or PIN is incorrect." : "House number or PIN is incorrect.";
        return reply({ error: `${what} ${left} ${left === 1 ? "try" : "tries"} left.` }, 401);
      }

      await admin.from("login_attempts").delete().eq("login", login);
      return reply({ ok: true, access_token: session.access_token, refresh_token: session.refresh_token });
    }

    // ---------- everything below needs a signed-in caller ----------
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: who } = await asCaller.auth.getUser();
    if (!who?.user) return reply({ error: "Please sign in again." }, 401);
    const { data: me } = await admin.from("profiles").select("role,status").eq("id", who.user.id).single();
    if (!me || me.status !== "active") return reply({ error: "Your account is not active." }, 403);

    if (body.action === "change_pin") {
      const pin = String(body.pin ?? "");
      if (isWeakPin(pin)) return reply({ error: "That PIN is too easy to guess. Please choose another." }, 400);
      const login = who.user.email ?? "";
      if (!login.endsWith(RES_DOMAIN) && !login.endsWith(GUARD_DOMAIN)) return reply({ error: "This account does not use a PIN." }, 400);
      const { error: pwErr } = await admin.auth.admin.updateUserById(who.user.id, { password: await pepper(pin, login) });
      if (pwErr) return reply({ error: pwErr.message }, 400);
      await admin.from("profiles").update({ must_change_pin: false }).eq("id", who.user.id);
      await admin.from("login_attempts").delete().eq("login", login);
      return reply({ ok: true });
    }

    if (me.role !== "estate_manager") return reply({ error: "Only the Estate Manager can do this." }, 403);

    if (body.action === "create_guard") {
      const full_name = String(body.full_name ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const num = cleanNumber(body.guard_number);
      const pin = String(body.pin ?? "");
      if (full_name.length < 2) return reply({ error: "Please enter the guard's full name." }, 400);
      if (!/^\d{1,4}$/.test(num) || num === "0") return reply({ error: "Guard number must be a number, e.g. 7." }, 400);
      if (isWeakPin(pin)) return reply({ error: "Please choose a 6-digit PIN that is not easy to guess." }, 400);
      const { data: taken } = await admin.from("profiles").select("id").eq("role", "guard").eq("guard_number", num).maybeSingle();
      if (taken) return reply({ error: `Guard ${num} already exists.` }, 409);
      const login = guardLogin(num);
      const { data: made, error: makeErr } = await admin.auth.admin.createUser({ email: login, password: await pepper(pin, login), email_confirm: true });
      if (makeErr || !made?.user) {
        return reply({ error: /already/i.test(makeErr?.message ?? "") ? `Guard ${num} already exists.` : makeErr?.message ?? "Could not create the guard." }, 400);
      }
      const { error: profErr } = await admin.from("profiles").insert({
        id: made.user.id, role: "guard", full_name, phone: phone || null, guard_number: num,
        assigned_gate: 1, status: "active", created_by: who.user.id,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(made.user.id);
        return reply({ error: profErr.message }, 400);
      }
      return reply({ ok: true, guard_number: num });
    }

    if (body.action === "reset_pin") {
      const id = String(body.profile_id ?? "");
      const { data: target } = await admin.from("profiles").select("id,role").eq("id", id).maybeSingle();
      if (!target || (target.role !== "resident" && target.role !== "guard")) return reply({ error: "Person not found." }, 404);
      const { data: u } = await admin.auth.admin.getUserById(id);
      const login = u?.user?.email ?? "";
      if (!login) return reply({ error: "Login not found." }, 404);
      const temp = randomPin();
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: await pepper(temp, login) });
      if (pwErr) return reply({ error: pwErr.message }, 400);
      const { data: flagged, error: flagErr } = await admin.from("profiles").update({ must_change_pin: true }).eq("id", id).select("id");
      if (flagErr || !flagged || flagged.length !== 1) return reply({ error: flagErr?.message ?? "Could not mark the PIN for change." }, 400);
      await admin.from("login_attempts").delete().eq("login", login);
      return reply({ ok: true, temp_pin: temp });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    return reply({ error: (e as Error).message }, 500);
  }
});
