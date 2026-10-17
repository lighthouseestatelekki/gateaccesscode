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

function emailHtml(title: string, body: string, url: string, sos: boolean) {
  const accent = sos ? "#D6453C" : "#3FAE7A";
  return `<!doctype html><html><body style="margin:0;background:#F4F7F5;font-family:Arial,Helvetica,sans-serif;color:#0C241B">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#123528;padding:20px 24px;color:#E8C547;font-size:18px;font-weight:bold">Lighthouse Lekki</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 6px;color:#6A7D73;font-size:14px">Assalam Alaekum,</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${sos ? "#D6453C" : "#0C241B"}">${esc(title)}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;white-space:pre-line">${esc(body)}</p>
<a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Open the app</a>
</td></tr>
<tr><td style="padding:16px 24px;color:#6A7D73;font-size:12px">You receive this because you are registered at Lighthouse Estate Lekki.</td></tr>
</table></td></tr></table></body></html>`;
}

type Notice = { id: string; recipient_id: string; kind: string; title: string; body: string | null; link: string | null };

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

    const { data: notes } = await admin.from("notifications").select("id,recipient_id,kind,title,body,link").in("id", ids);
    const list = (notes ?? []) as Notice[];
    const people = [...new Set(list.map((n) => n.recipient_id))];
    const appUrl = (Deno.env.get("APP_URL") ?? "https://gateaccesscode.pages.dev").replace(/\/$/, "");

    // ---------- push ----------
    let pushed = 0;
    const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", people);
    if (subs?.length) {
      const keys = await vapidKeys();
      webpush.setVapidDetails("mailto:noreply@lighthouseestate.app", keys.publicKey, keys.privateKey);
      const dead = new Set<string>();
      const jobs: Promise<void>[] = [];
      for (const n of list) {
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
      const { data: profs } = await admin.from("profiles").select("id,full_name,email").in("id", people);
      const emailOf = new Map((profs ?? []).filter((p) => p.email && /@/.test(p.email) && !/lighthouseestate\.app$/i.test(p.email)).map((p) => [p.id, p]));
      // Same message to many people (e.g. an announcement) = one Brevo call with many recipients.
      const groups = new Map<string, { n: Notice; to: { email: string; name?: string }[] }>();
      for (const n of list) {
        const p = emailOf.get(n.recipient_id);
        if (!p) continue;
        const k = `${n.kind}|${n.title}|${n.body}`;
        if (!groups.has(k)) groups.set(k, { n, to: [] });
        groups.get(k)!.to.push({ email: p.email!, name: p.full_name ?? undefined });
      }
      for (const { n, to } of groups.values()) {
        const sos = n.kind === "sos";
        for (let i = 0; i < to.length; i += 900) {
          const batch = to.slice(i, i + 900);
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { email: from, name: Deno.env.get("EMAIL_FROM_NAME") ?? "Lighthouse Lekki" },
              subject: (sos ? "🚨 " : "") + n.title,
              htmlContent: emailHtml(n.title, n.body ?? "", appUrl + (n.link ?? "/"), sos),
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
