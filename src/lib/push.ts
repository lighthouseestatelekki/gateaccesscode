import { supabase } from "@/lib/supabase";
import { isInstalled } from "@/lib/install";

export type AlertStatus = "unsupported" | "ios-install-first" | "blocked" | "off" | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function b64uToBytes(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** What this phone can do about alerts right now. */
export async function alertStatus(): Promise<AlertStatus> {
  try {
    if (isIOS() && !isInstalled()) return "ios-install-first";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Ask permission, subscribe this phone and save it for the signed-in person. Throws a readable Error. */
export async function enableAlerts(userId: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Alerts were not allowed. You can allow them in your phone's settings for this site.");
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const { data, error } = await supabase.functions.invoke("notify", { body: { action: "vapid_public_key" } });
  if (error || !data?.key) throw new Error("Could not reach the alert service. Please try again.");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(data.key) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error: insErr } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  });
  // 23505 = this phone is already saved, which is fine
  if (insErr && insErr.code !== "23505") throw new Error(insErr.message);
}
