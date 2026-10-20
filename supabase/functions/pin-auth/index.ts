// Supabase Edge Function: pin-auth
// Every PIN-based action goes through here so we can (1) lock a login after repeated wrong PINs
// and (2) never store a bare 6-digit PIN as a password. The real password is a keyed hash of the
// PIN (secret PIN_PEPPER), so guessing PINs directly against Supabase Auth is useless.
//
// Actions:
//   register     — anyone: create a pending resident
//   login        — anyone: resident (house + unit + PIN) or guard (number + PIN).
//                  5 wrong PINs locks only that phone for 15 minutes. 20 wrong PINs on one house/guard
//                  from all phones within an hour locks it for 15 minutes and alerts the owner + Estate Manager.
//   change_pin   — signed-in user: set a new PIN, clears "must change PIN"
//   create_guard — Estate Manager only
//   reset_pin    — Estate Manager only: temporary PIN for a resident or guard, clears any lock
//   add_member / remove_member — main resident only: adults in the same house get their own PIN
// Household members sign in on the SAME house + unit screen with their own PIN.
// Estate Manager actions need the authenticator step (aal2).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_FAILS = 5; // per phone
const HOUSE_MAX_FAILS = 20; // all phones together, per hour
const WINDOW_MINUTES = 60;
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
const memberLogin = (house: string, unit: string, no: number) => `house${house}-${unit}.m${no}@${RES_DOMAIN}`;
/** The house's shared login (wrong-PIN counters are kept per house, not per person). */
const baseLogin = (email: string) => email.replace(/\.m\d+@/, "@");
/** Claims inside the caller's (already verified) access token. */
function claims(req: Request): Record<string, unknown> {
  try {
    const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").split(".")[1] ?? "";
    return JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}
const guardLogin = (num: string) => `guard${num}@${GUARD_DOMAIN}`;

// deno-lint-ignore no-explicit-any
type Admin = any;

async function clearLocks(admin: Admin, login: string) {
  await admin.from("login_attempts").delete().eq("login", login);
  await admin.from("login_device_attempts").delete().eq("login", login);
}

/** Tell the house's resident (or the guard) and every Estate Manager that someone is guessing PINs. */
async function alertOwners(admin: Admin, login: string, kind: "guard" | "resident") {
  const m = kind === "guard" ? login.match(/^guard(\d+)@/) : login.match(/^house(\d+)-([a-z]+)@/);
  if (!m) return;
  const owners = kind === "guard"
    ? await admin.from("profiles").select("id").eq("role", "guard").eq("guard_number", m[1]).eq("status", "active")
    : await admin.from("profiles").select("id").eq("role", "resident").eq("house_number", m[1]).eq("house_unit", m[2]).eq("status", "active");
  const managers = await admin.from("profiles").select("id").eq("role", "estate_manager").eq("status", "active");
  const who = kind === "guard" ? `Guard ${m[1]}` : `House ${m[1]}`;
  const rows = [
    ...(owners.data ?? []).map((p: { id: string }) => ({
      recipient_id: p.id, kind: "security", link: "/inbox",
      title: "Many wrong PINs on your account",
      body: `Someone typed many wrong PINs for ${who}. New sign-ins are paused for ${LOCK_MINUTES} minutes. You stay signed in. If this wasn't you, change your PIN from More.`,
    })),
    ...(managers.data ?? []).map((p: { id: string }) => ({
      recipient_id: p.id, kind: "security", link: "/manager/residents",
      title: `Many wrong PINs: ${who}`,
      body: `${HOUSE_MAX_FAILS} wrong PINs in under an hour. Sign-in for ${who} is paused for ${LOCK_MINUTES} minutes.`,
    })),
  ];
  if (rows.length) await admin.from("notifications").insert(rows);
}

/** Writes an entry in the Estate Manager action history. */
// deno-lint-ignore no-explicit-any
async function history(admin: any, actorId: string, action: string, target: string) {
  const { data: a } = await admin.from("profiles").select("full_name,role").eq("id", actorId).maybeSingle();
  await admin.from("audit_log").insert({ actor_id: actorId, actor_name: a?.full_name ?? null, actor_role: a?.role ?? null, action, target });
}

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
      let { data: made, error: makeErr } = await admin.auth.admin.createUser({ email: login, password: await pepper(pin, login), email_confirm: true });
      if (makeErr && /already/i.test(makeErr.message ?? "")) {
        // The last household here moved out: retire their old sign-in so the new household can register.
        const { data: old } = await admin.from("profiles").select("id")
          .eq("role", "resident").eq("household_role", "primary").eq("house_number", house).eq("house_unit", unit).eq("status", "moved_out");
        const active = await admin.from("profiles").select("id", { count: "exact", head: true })
          .eq("role", "resident").eq("household_role", "primary").eq("house_number", house).eq("house_unit", unit).neq("status", "moved_out");
        if (old?.length && !active.count) {
          for (const o of old) await admin.auth.admin.updateUserById(o.id, { email: `moved-${o.id}@residents.lighthouseestate.app` });
          ({ data: made, error: makeErr } = await admin.auth.admin.createUser({ email: login, password: await pepper(pin, login), email_confirm: true }));
        }
      }
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

      // Which phone is trying. The app sends a random id it keeps; fall back to the network address.
      const rawDevice = String(body.device ?? "");
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
      const device = /^[A-Za-z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : `ip:${ip}`;
      const now = Date.now();
      const minsLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60000));
      const plural = (n: number) => `${n} minute${n === 1 ? "" : "s"}`;

      const { data: dev } = await admin.from("login_device_attempts").select("fails,locked_until,updated_at").eq("login", login).eq("device", device).maybeSingle();
      if (dev?.locked_until && new Date(dev.locked_until).getTime() > now) {
        return reply({ error: `Too many wrong PINs on this phone. Please wait ${plural(minsLeft(dev.locked_until))}, or ask the Estate Manager to reset your PIN.`, locked: true }, 423);
      }
      const { data: att } = await admin.from("login_attempts").select("fails,locked_until,window_start").eq("login", login).maybeSingle();
      if (att?.locked_until && new Date(att.locked_until).getTime() > now) {
        return reply({ error: `For safety, sign-in for this ${kind === "guard" ? "guard number" : "house"} is paused after many wrong PINs. Please wait ${plural(minsLeft(att.locked_until))}, or ask the Estate Manager to reset your PIN.`, locked: true }, 423);
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
      if (!session && kind === "resident") {
        // Not the main resident's PIN: try the other adults registered in this house.
        const house = cleanNumber(body.house_number);
        const unit = String(body.house_unit ?? "");
        const { data: members } = await admin.from("profiles").select("member_no")
          .eq("role", "resident").eq("household_role", "member").eq("house_number", house).eq("house_unit", unit)
          .not("status", "in", "(declined,moved_out)").order("member_no").limit(8);
        for (const m of members ?? []) {
          const ml = memberLogin(house, unit, m.member_no);
          session = (await fresh().auth.signInWithPassword({ email: ml, password: await pepper(pin, ml) })).data.session;
          if (session) break;
        }
      }

      if (!session) {
        const stamp = new Date(now).toISOString();
        // 1) This phone.
        const devStale = !dev || !!dev.locked_until || now - new Date(dev.updated_at).getTime() > WINDOW_MINUTES * 60000;
        const devFails = (devStale ? 0 : dev.fails) + 1;
        const devLock = devFails >= MAX_FAILS;
        await admin.from("login_device_attempts").upsert({
          login, device,
          fails: devLock ? 0 : devFails,
          locked_until: devLock ? new Date(now + LOCK_MINUTES * 60000).toISOString() : null,
          updated_at: stamp,
        });
        // 2) All phones together, within the last hour.
        const fresh_window = !att?.window_start || now - new Date(att.window_start).getTime() > WINDOW_MINUTES * 60000;
        const houseFails = (fresh_window ? 0 : att?.fails ?? 0) + 1;
        const houseLock = houseFails >= HOUSE_MAX_FAILS;
        await admin.from("login_attempts").upsert({
          login,
          fails: houseLock ? 0 : houseFails,
          window_start: houseLock ? null : fresh_window ? stamp : att!.window_start,
          locked_until: houseLock ? new Date(now + LOCK_MINUTES * 60000).toISOString() : null,
          updated_at: stamp,
        });
        if (houseLock) await alertOwners(admin, login, kind);

        if (devLock || houseLock) {
          return reply({ error: `Too many wrong PINs. Please wait ${plural(LOCK_MINUTES)}, or ask the Estate Manager to reset your PIN.`, locked: true }, 423);
        }
        const left = MAX_FAILS - devFails;
        const what = kind === "guard" ? "Guard number or PIN is incorrect." : "House number or PIN is incorrect.";
        return reply({ error: `${what} ${left} ${left === 1 ? "try" : "tries"} left.` }, 401);
      }

      // Success clears this phone's count only, so someone guessing elsewhere can't reset the hourly total.
      await admin.from("login_device_attempts").delete().eq("login", login).eq("device", device);
      const { data: st } = await admin.from("profiles").select("status").eq("id", session.user.id).maybeSingle();
      if (st?.status === "moved_out") {
        await admin.auth.admin.signOut(session.access_token).catch(() => {});
        return reply({ error: "This account was closed when the household moved out. If you still live here, please contact the Estate Manager." }, 403);
      }
      return reply({ ok: true, access_token: session.access_token, refresh_token: session.refresh_token });
    }

    // ---------- everything below needs a signed-in caller ----------
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: who } = await asCaller.auth.getUser();
    if (!who?.user) return reply({ error: "Please sign in again." }, 401);
    const { data: me } = await admin.from("profiles")
      .select("id,role,status,full_name,house_number,house_unit,household_role,sessions_revoked_at").eq("id", who.user.id).single();
    if (!me || me.status !== "active") return reply({ error: "Your account is not active." }, 403);
    const jwt = claims(req);
    if (me.sessions_revoked_at && Number(jwt.iat ?? 0) < Math.floor(new Date(me.sessions_revoked_at).getTime() / 1000)) {
      return reply({ error: "Please sign in again." }, 401);
    }

    /** Is this PIN already used by someone else in the same house? (Each person needs their own.) */
    async function pinTakenInHouse(pin: string, house: string, unit: string, exceptId: string) {
      const { data: people } = await admin.from("profiles").select("id,household_role,member_no")
        .eq("role", "resident").eq("house_number", house).eq("house_unit", unit).neq("id", exceptId).not("status", "in", "(declined,moved_out)");
      for (const p of people ?? []) {
        const l = p.household_role === "member" ? memberLogin(house, unit, p.member_no) : residentLogin(house, unit);
        const { data } = await fresh().auth.signInWithPassword({ email: l, password: await pepper(pin, l) });
        if (data.session) {
          await admin.auth.admin.signOut(data.session.access_token).catch(() => {});
          return true;
        }
      }
      return false;
    }

    if (body.action === "change_pin") {
      const pin = String(body.pin ?? "");
      if (isWeakPin(pin)) return reply({ error: "That PIN is too easy to guess. Please choose another." }, 400);
      const login = who.user.email ?? "";
      if (!login.endsWith(RES_DOMAIN) && !login.endsWith(GUARD_DOMAIN)) return reply({ error: "This account does not use a PIN." }, 400);
      if (me.role === "resident" && (await pinTakenInHouse(pin, me.house_number, me.house_unit, me.id))) {
        return reply({ error: "Someone else in your house uses that PIN. Please choose a different one." }, 400);
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(who.user.id, { password: await pepper(pin, login) });
      if (pwErr) return reply({ error: pwErr.message }, 400);
      await admin.from("profiles").update({ must_change_pin: false }).eq("id", who.user.id);
      await clearLocks(admin, baseLogin(login));
      return reply({ ok: true });
    }

    // ---------- household members (main resident only) ----------
    if (body.action === "add_member" || body.action === "remove_member") {
      if (me.role !== "resident" || me.household_role !== "primary") return reply({ error: "Only the main resident of the house can do this." }, 403);
      const house = me.house_number, unit = me.house_unit;

      if (body.action === "add_member") {
        const full_name = String(body.full_name ?? "").trim();
        const phone = String(body.phone ?? "").trim();
        const relation = String(body.relation ?? "").trim().slice(0, 40);
        const email = String(body.email ?? "").trim();
        if (full_name.length < 2) return reply({ error: "Please enter their full name." }, 400);
        if (phone && phone.replace(/\D/g, "").length < 10) return reply({ error: "Please check the phone number." }, 400);
        if (email && !/^\S+@\S+\.\S+$/.test(email)) return reply({ error: "Please check the email address." }, 400);
        const { data: all } = await admin.from("profiles").select("member_no,status")
          .eq("role", "resident").eq("household_role", "member").eq("house_number", house).eq("house_unit", unit);
        if ((all ?? []).filter((m) => m.status === "active").length >= 6) return reply({ error: "A house can have up to 6 household members." }, 400);
        const no = Math.max(0, ...(all ?? []).map((m) => m.member_no ?? 0)) + 1;
        const login = memberLogin(house, unit, no);
        let temp = randomPin();
        for (let i = 0; i < 5 && (await pinTakenInHouse(temp, house, unit, me.id)); i++) temp = randomPin();
        const { data: made, error: makeErr } = await admin.auth.admin.createUser({ email: login, password: await pepper(temp, login), email_confirm: true });
        if (makeErr || !made?.user) return reply({ error: makeErr?.message ?? "Could not add this person." }, 400);
        const { error: profErr } = await admin.from("profiles").insert({
          id: made.user.id, role: "resident", status: "active", full_name, phone: phone || null, email: email || null,
          house_number: house, house_unit: unit, household_role: "member", member_of: me.id, member_no: no,
          relation: relation || null, must_change_pin: true, created_by: me.id,
        });
        if (profErr) {
          await admin.auth.admin.deleteUser(made.user.id);
          return reply({ error: profErr.message }, 400);
        }
        const { data: managers } = await admin.from("profiles").select("id").eq("role", "estate_manager").eq("status", "active");
        if (managers?.length) {
          await admin.from("notifications").insert(managers.map((m) => ({
            recipient_id: m.id, kind: "household", link: "/manager/residents",
            title: `New household member at House ${house}`,
            body: `${me.full_name} added ${full_name}${relation ? ` (${relation})` : ""}. You can suspend them from Residents if needed.`,
          })));
        }
        return reply({ ok: true, temp_pin: temp, member_no: no });
      }

      // remove_member
      const id = String(body.profile_id ?? "");
      const { data: t } = await admin.from("profiles").select("id,member_of,full_name").eq("id", id).maybeSingle();
      if (!t || t.member_of !== me.id) return reply({ error: "Person not found in your household." }, 404);
      await admin.from("profiles").update({ status: "moved_out", moved_out_at: new Date().toISOString() }).eq("id", id);
      await admin.rpc("revoke_user_sessions", { p_user: id });
      return reply({ ok: true });
    }

    if (me.role !== "estate_manager") return reply({ error: "Only the Estate Manager can do this." }, 403);
    // Two-step: authenticator code (aal2), or a fingerprint sign-in (recorded as a strong session).
    const sid = String(jwt.session_id ?? "");
    const strong = jwt.aal === "aal2" || (!!sid && !!(await admin.from("strong_sessions").select("session_id").eq("session_id", sid).eq("user_id", who.user.id).maybeSingle()).data);
    if (!strong) return reply({ error: "Please confirm your sign-in with your authenticator code or fingerprint first." }, 403);

    // ---------- more than one Estate Manager ----------
    if (body.action === "create_manager" || body.action === "reset_manager") {
      const temp = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
      const tempPassword = `${temp.slice(0, 3)}-${temp.slice(3, 6)}-${temp.slice(6)}`;
      if (body.action === "create_manager") {
        const full_name = String(body.full_name ?? "").trim().slice(0, 80);
        const email = String(body.email ?? "").trim().toLowerCase();
        if (full_name.length < 2) return reply({ error: "Please enter their full name." }, 400);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ error: "Please enter a valid email address." }, 400);
        const { data: made, error: makeErr } = await admin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
        if (makeErr || !made?.user) return reply({ error: /already/i.test(makeErr?.message ?? "") ? "This email already has an account." : makeErr?.message ?? "Could not add the Estate Manager." }, 409);
        const { error: profErr } = await admin.from("profiles").insert({
          id: made.user.id, role: "estate_manager", status: "active", full_name, email, must_change_pin: true, created_by: who.user.id,
        });
        if (profErr) {
          await admin.auth.admin.deleteUser(made.user.id);
          return reply({ error: profErr.message }, 400);
        }
        await history(admin, who.user.id, "Added an Estate Manager", `${full_name} (${email})`);
        return reply({ ok: true, temp_password: tempPassword });
      }
      // reset_manager: lost phone or forgotten password. New temporary password; authenticator and fingerprints removed.
      const id = String(body.profile_id ?? "");
      if (id === who.user.id) return reply({ error: "Ask another Estate Manager to reset your sign-in." }, 400);
      const { data: t } = await admin.from("profiles").select("id,role,full_name").eq("id", id).maybeSingle();
      if (!t || t.role !== "estate_manager") return reply({ error: "Estate Manager not found." }, 404);
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
      if (pwErr) return reply({ error: pwErr.message }, 400);
      const { data: f } = await admin.auth.admin.mfa.listFactors({ userId: id });
      for (const x of f?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: id, id: x.id });
      await admin.from("passkeys").delete().eq("user_id", id);
      await admin.from("profiles").update({ must_change_pin: true }).eq("id", id);
      await admin.rpc("revoke_user_sessions", { p_user: id });
      await history(admin, who.user.id, "Reset an Estate Manager's sign-in", t.full_name);
      return reply({ ok: true, temp_password: tempPassword });
    }

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
      await history(admin, who.user.id, "Added a guard", `Guard ${num} (${full_name})`);
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
      await clearLocks(admin, baseLogin(login));
      const { data: tp } = await admin.from("profiles").select("full_name,role,guard_number,house_number").eq("id", id).maybeSingle();
      await history(admin, who.user.id, "Reset a PIN", tp ? (tp.role === "guard" ? `Guard ${tp.guard_number} (${tp.full_name})` : `${tp.full_name}, House ${tp.house_number}`) : id);
      return reply({ ok: true, temp_pin: temp });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    return reply({ error: (e as Error).message }, 500);
  }
});
