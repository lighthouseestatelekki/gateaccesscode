// Supabase Edge Function: staff-admin
// Lets the Estate Manager (and ONLY the Estate Manager) do two things that need admin rights:
//   1. create_guard  — make a new guard login + profile
//   2. reset_pin     — give a resident a temporary 6-digit PIN they must change at next login
// The service-role key never leaves the server. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function isWeakPin(pin: string): boolean {
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
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const pin = String(n).padStart(6, "0");
    if (!isWeakPin(pin)) return pin;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Who is calling? Use THEIR token, never trust anything else.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoErr } = await asCaller.auth.getUser();
  if (whoErr || !who?.user) return reply({ error: "Please sign in again." }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin.from("profiles").select("role,status").eq("id", who.user.id).single();
  if (!me || me.role !== "estate_manager" || me.status !== "active") {
    return reply({ error: "Only the Estate Manager can do this." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }

  // 2) Create a guard
  if (body.action === "create_guard") {
    const fullName = String(body.full_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const guardNumber = String(Number(String(body.guard_number ?? "").trim()));
    const pin = String(body.pin ?? "");
    if (fullName.length < 2) return reply({ error: "Please enter the guard's full name." }, 400);
    if (!/^\d{1,4}$/.test(guardNumber) || guardNumber === "0") return reply({ error: "Guard number must be a number, e.g. 7." }, 400);
    if (isWeakPin(pin)) return reply({ error: "Please choose a 6-digit PIN that is not easy to guess." }, 400);

    const { data: taken } = await admin.from("profiles").select("id").eq("role", "guard").eq("guard_number", guardNumber).maybeSingle();
    if (taken) return reply({ error: `Guard ${guardNumber} already exists.` }, 409);

    const email = `guard${guardNumber}@guards.lighthouseestate.app`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password: pin, email_confirm: true });
    if (createErr || !created?.user) {
      const msg = /already/i.test(createErr?.message ?? "") ? `Guard ${guardNumber} already exists.` : (createErr?.message ?? "Could not create the guard.");
      return reply({ error: msg }, 400);
    }

    const { error: profErr } = await admin.from("profiles").insert({
      id: created.user.id,
      role: "guard",
      full_name: fullName,
      phone: phone || null,
      guard_number: guardNumber,
      assigned_gate: 1,
      status: "active",
      created_by: who.user.id,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(created.user.id); // undo, so no half-made guard is left behind
      return reply({ error: profErr.message }, 400);
    }
    return reply({ ok: true, guard_number: guardNumber });
  }

  // 3) Reset a resident's PIN
  if (body.action === "reset_pin") {
    const id = String(body.profile_id ?? "");
    const { data: target } = await admin.from("profiles").select("id,role").eq("id", id).maybeSingle();
    if (!target || target.role !== "resident") return reply({ error: "Resident not found." }, 404);

    const temp = randomPin();
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: temp });
    if (pwErr) return reply({ error: pwErr.message }, 400);

    const { data: flagged, error: flagErr } = await admin.from("profiles").update({ must_change_pin: true }).eq("id", id).select("id");
    if (flagErr || !flagged || flagged.length !== 1) return reply({ error: flagErr?.message ?? "Could not mark the PIN for change." }, 400);

    return reply({ ok: true, temp_pin: temp });
  }

  return reply({ error: "Unknown action." }, 400);
});
