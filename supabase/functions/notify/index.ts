// Supabase Edge Function: notify
// Sends each new inbox notice as (1) a push alert to every phone the person turned alerts on for,
// and (2) an email (via Brevo) when the person has an email address.
//
// Actions:
//   vapid_public_key — anyone: the public key phones need to subscribe to alerts
//   deliver          — database only (secret header): deliver the given notice ids
//
// Secrets used: PIN_PEPPER (already set; the push signing key is derived from it),
//               BREVO_API_KEY and EMAIL_FROM (optional: no email is sent until both are set),
//               EMAIL_FROM_NAME and APP_URL (optional).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { p256 } from "npm:@noble/curves@1.6.0/p256";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Push signing keys, derived from PIN_PEPPER so there is no extra secret to manage. Same input = same keys. */
async function vapidKeys() {
  const secret = Deno.env.get("PIN_PEPPER");
  if (!secret) throw new Error("Server is missing PIN_PEPPER.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let counter = 0;
  for (;;) {
    const d = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`vapid-v1:${counter}`)));
    if (p256.utils.isValidPrivateKey(d)) return { privateKey: b64u(d), publicKey: b64u(p256.getPublicKey(d, false)) };
    counter++;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ---- email template start ----
type Details = Record<string, unknown> | null;
type Look = { accent: string; soft: string; label: string; icon: string; button: string };

const GREEN = "#3FAE7A", GOLD = "#C9A227", RED = "#D6453C", TEAL = "#0E7C86", GREY = "#6A7D73", DEEP = "#123528", AMBER = "#C2410C";
const soft = (hex: string) => ({ [GREEN]: "#E6F5EE", [GOLD]: "#FBF3D9", [RED]: "#FBE7E5", [TEAL]: "#E1F2F3", [GREY]: "#EEF1EF", [DEEP]: "#E3EDE8", [AMBER]: "#FDEBE1" })[hex] ?? "#EEF1EF";
const look = (accent: string, label: string, icon: string, button: string): Look => ({ accent, soft: soft(accent), label, icon, button });

/** How each kind of alert looks: colour, label, icon and button text. */
const LOOKS: Record<string, Look> = {
  announcement: look(GOLD, "Announcement", "📣", "Read in the app"),
  code_in: look(GREEN, "Visitor arrived", "🚪", "See your codes"),
  code_out: look(TEAL, "Visitor left", "👋", "See your codes"),
  code_refused: look(RED, "Refused at the gate", "⛔", "Check the code"),
  code_switched_off: look(GREY, "Code switched off", "⏸️", "See your codes"),
  approved: look(GREEN, "Welcome", "✅", "Open the app"),
  sos: look(RED, "SOS emergency", "🚨", "Respond now"),
  code_expiring: look(GOLD, "Code ending soon", "⏳", "Extend the code"),
  code_changed: look(GOLD, "Code updated", "✏️", "See your codes"),
  code_created_for_you: look(GOLD, "New code for your home", "🔑", "See your codes"),
  security: look(AMBER, "Security alert", "🛡️", "Open the app"),
  fixit: look(TEAL, "Fix-It", "🔧", "See the request"),
  household: look(GREEN, "Household", "🏠", "Open the app"),
  staff: look(GOLD, "Staff", "🪪", "Review now"),
  incident: look(RED, "Gate report", "⚠️", "See the report"),
  moving: look(GREEN, "Moving out", "🚚", "Open the app"),
  weekly: look(DEEP, "Weekly summary", "📊", "See full insights"),
};

function detailRows(d: Details): [string, string][] {
  if (!d) return [];
  return Object.entries(d)
    .filter(([k, v]) => !k.startsWith("_") && v != null && v !== "")
    .map(([k, v]) => [k, String(v)]);
}

export function emailHtml(opts: { kind: string; title: string; body: string; url: string; appUrl: string; details?: Details; phone?: string | null }) {
  const L = LOOKS[opts.kind] ?? look(GREEN, "Alert", "🔔", "Open the app");
  const d = (opts.details ?? null) as Details;
  const weekly = opts.kind === "weekly" && !!d?._weekly;
  const rows = weekly ? [] : detailRows(d);
  const cell = "font-family:Arial,Helvetica,sans-serif";

  const card = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F6F8F7;border:1px solid #E3EAE6;border-radius:14px">
${rows.map(([k, v], i) => `<tr><td style="${cell};padding:11px 16px;${i ? "border-top:1px solid #E3EAE6;" : ""}color:#6A7D73;font-size:14px;white-space:nowrap" valign="top">${esc(k)}</td>
<td style="${cell};padding:11px 16px;${i ? "border-top:1px solid #E3EAE6;" : ""}color:#0C241B;font-size:15px;font-weight:bold;text-align:right">${esc(v)}</td></tr>`).join("")}
</table>`
    : "";

  let weeklyHtml = "";
  if (weekly) {
    const stats = (d!._stats as { label: string; value: number }[] | undefined) ?? [];
    const tiles = stats.map((s) => `<td width="50%" style="padding:6px" valign="top"><div style="background:#F6F8F7;border:1px solid #E3EAE6;border-radius:14px;padding:14px 16px">
<div style="${cell};font-size:28px;font-weight:bold;color:${DEEP};line-height:1">${esc(String(s.value))}</div>
<div style="${cell};font-size:13px;color:#6A7D73;margin-top:6px">${esc(s.label)}</div></div></td>`);
    const grid: string[] = [];
    for (let i = 0; i < tiles.length; i += 2) grid.push(`<tr>${tiles[i]}${tiles[i + 1] ?? '<td width="50%"></td>'}</tr>`);
    const top = (d!._top as { name: string; visits: number }[] | undefined) ?? [];
    const todo = Object.entries((d!._todo as Record<string, number> | undefined) ?? {});
    const list = (title: string, items: [string, string][]) => items.length
      ? `<p style="${cell};margin:18px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#6A7D73">${esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7;border:1px solid #E3EAE6;border-radius:14px">
${items.map(([a, b], i) => `<tr><td style="${cell};padding:10px 16px;${i ? "border-top:1px solid #E3EAE6;" : ""}font-size:15px;color:#0C241B">${esc(a)}</td><td style="${cell};padding:10px 16px;${i ? "border-top:1px solid #E3EAE6;" : ""}font-size:15px;font-weight:bold;color:#0C241B;text-align:right">${esc(b)}</td></tr>`).join("")}</table>`
      : "";
    weeklyHtml = `<p style="${cell};margin:0 0 10px;font-size:14px;color:#6A7D73">${esc(String(d!._period ?? ""))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px">${grid.join("")}</table>
${list("Most frequent visitors", top.map((t) => [t.name, t.visits === 1 ? "1 visit" : `${t.visits} visits`]))}
${list("Needs your attention", todo.map(([k, v]) => [k, String(v)]))}
${d!._note ? `<p style="${cell};margin:16px 0 0;font-size:15px;color:#0C241B">${esc(String(d!._note))}</p>` : ""}
<div style="height:22px"></div>`;
  }

  const phoneBtn = opts.phone
    ? `<div style="height:10px"></div><a href="tel:${esc(opts.phone.replace(/[^\d+]/g, ""))}" style="${cell};display:inline-block;margin:0;background:#ffffff;color:${RED};border:2px solid ${RED};text-decoration:none;font-weight:bold;font-size:15px;padding:11px 18px;border-radius:12px">📞 Call ${esc(opts.phone)}</a>`
    : "";
  const footerNote = weekly
    ? "To stop the weekly summary, open the app and go to More → Weekly summary email."
    : "You get these alerts because you are registered with Light House Estate, Lekki.";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#EEF3F0">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.body).slice(0, 140)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E3EAE6">
<tr><td style="background:${DEEP};padding:18px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:10px"><img src="${opts.appUrl}/email/logo.png" width="30" height="30" alt="" style="display:block;border:0"></td>
    <td valign="middle" style="${cell};color:#E8C547;font-size:15px;font-weight:800;letter-spacing:.14em">LIGHT HOUSE ESTATE<div style="font-size:11px;font-weight:normal;letter-spacing:.08em;color:#A9C2B6;margin-top:2px">LEKKI</div></td>
  </tr></table>
</td></tr>
<tr><td style="height:5px;background:${L.accent};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:26px 26px 8px">
  <span style="${cell};display:inline-block;background:${L.soft};color:${L.accent};font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px">${L.icon}&nbsp; ${esc(L.label)}</span>
  <p style="${cell};margin:18px 0 4px;color:#6A7D73;font-size:15px">Assalam Alaekum,</p>
  <h1 style="${cell};margin:0 0 10px;font-size:24px;line-height:1.3;color:${opts.kind === "sos" ? RED : "#0C241B"}">${esc(opts.title)}</h1>
  <p style="${cell};margin:0 0 22px;font-size:16px;line-height:1.55;color:#33463D;white-space:pre-line">${esc(opts.body)}</p>
  ${card}${weeklyHtml}
  <a href="${opts.url}" style="${cell};display:inline-block;background:${L.accent};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:12px">${esc(L.button)} →</a>${phoneBtn}
  <div style="height:26px"></div>
</td></tr>
<tr><td style="padding:18px 26px 24px;border-top:1px solid #EEF1EF">
  <p style="${cell};margin:0 0 6px;color:#6A7D73;font-size:12px;line-height:1.5">${esc(footerNote)}</p>
  <p style="${cell};margin:0;color:#6A7D73;font-size:12px"><a href="${opts.appUrl}" style="color:#3B7F63">Open the app</a> &nbsp;·&nbsp; <a href="${opts.appUrl}/privacy" style="color:#3B7F63">Privacy notice</a></p>
</td></tr>
</table>
<p style="${cell};margin:14px 0 0;color:#93A69C;font-size:11px">Light House Estate, Lekki · Lagos</p>
</td></tr></table></body></html>`;
}
// ---- email template end ----

type Notice = { id: string; recipient_id: string; kind: string; title: string; body: string | null; link: string | null; details: Details };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }

  try {
    if (body.action === "vapid_public_key") {
      return reply({ key: (await vapidKeys()).publicKey });
    }

    if (body.action !== "deliver") return reply({ error: "Unknown action." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: sec } = await admin.from("app_secrets").select("value").eq("name", "notify_hook").single();
    if (!sec || req.headers.get("x-hook-secret") !== sec.value) return reply({ error: "Not allowed." }, 403);

    const ids = Array.isArray(body.ids) ? (body.ids as string[]).slice(0, 2000) : [];
    if (!ids.length) return reply({ ok: true, push: 0, email: 0 });

    const { data: notes } = await admin.from("notifications").select("id,recipient_id,kind,title,body,link,details").in("id", ids);
    const list = (notes ?? []) as Notice[];
    const people = [...new Set(list.map((n) => n.recipient_id))];
    const appUrl = (Deno.env.get("APP_URL") ?? "https://lighthouse-gatecode.pages.dev").replace(/\/$/, "");

    // ---------- push ----------
    let pushed = 0;
    const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", people);
    if (subs?.length) {
      const keys = await vapidKeys();
      webpush.setVapidDetails("mailto:noreply@lighthouseestate.app", keys.publicKey, keys.privateKey);
      const dead = new Set<string>();
      const jobs: Promise<void>[] = [];
      for (const n of list) {
        if (n.kind === "weekly") continue; // the weekly summary is email only
        const sos = n.kind === "sos";
        const payload = JSON.stringify({ title: n.title, body: n.body ?? "", link: n.link ?? "/", kind: n.kind, tag: sos ? "sos" : n.id });
        for (const s of subs.filter((x) => x.user_id === n.recipient_id)) {
          jobs.push(
            webpush
              .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: sos ? 3600 : 86400, urgency: sos ? "high" : "normal" })
              .then(() => void pushed++)
              .catch((e: { statusCode?: number }) => {
                if (e?.statusCode === 404 || e?.statusCode === 410) dead.add(s.id);
              }),
          );
        }
      }
      await Promise.all(jobs);
      if (dead.size) await admin.from("push_subscriptions").delete().in("id", [...dead]);
    }

    // ---------- email (Brevo) ----------
    let emailed = 0;
    const apiKey = Deno.env.get("BREVO_API_KEY");
    const from = Deno.env.get("EMAIL_FROM");
    if (apiKey && from) {
      const { data: profs } = await admin.from("profiles").select("id,full_name,email,role").in("id", people);
      const emailOf = new Map((profs ?? []).filter((p) => p.email && /@/.test(p.email) && !/lighthouseestate\.app$/i.test(p.email)).map((p) => [p.id, p]));
      // Same message to many people (e.g. an announcement) = one Brevo call with many recipients.
      const groups = new Map<string, { n: Notice; phone: string | null; to: { email: string; name?: string }[] }>();
      for (const n of list) {
        const p = emailOf.get(n.recipient_id);
        if (!p) continue;
        // The SOS caller's phone goes only to guards and the Estate Manager.
        const raw = n.kind === "sos" ? (n.details?._phone as string | undefined) ?? null : null;
        const phone = raw && (p.role === "guard" || p.role === "estate_manager") ? raw : null;
        // Weekly summaries are personal, so each is its own email.
        const k = n.kind === "weekly" ? n.id : `${n.kind}|${n.title}|${n.body}|${JSON.stringify(n.details ?? null)}|${phone ?? ""}`;
        if (!groups.has(k)) groups.set(k, { n, phone, to: [] });
        groups.get(k)!.to.push({ email: p.email!, name: p.full_name ?? undefined });
      }
      for (const { n, phone, to } of groups.values()) {
        const sos = n.kind === "sos";
        const period = n.kind === "weekly" ? String(n.details?._period ?? "") : "";
        for (let i = 0; i < to.length; i += 900) {
          const batch = to.slice(i, i + 900);
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { email: from, name: Deno.env.get("EMAIL_FROM_NAME") ?? "Light House Estate, Lekki" },
              subject: (sos ? "🚨 " : "") + n.title + (period ? ` · ${period}` : ""),
              htmlContent: emailHtml({ kind: n.kind, title: n.title, body: n.body ?? "", url: appUrl + (n.link ?? "/"), appUrl, details: n.details, phone }),
              messageVersions: batch.map((r) => ({ to: [r] })),
            }),
          });
          if (res.ok) emailed += batch.length;
          else console.error("Brevo", res.status, await res.text());
        }
      }
    }

    return reply({ ok: true, notices: list.length, push: pushed, email: emailed });
  } catch (e) {
    console.error(e);
    return reply({ error: (e as Error).message }, 500);
  }
});
