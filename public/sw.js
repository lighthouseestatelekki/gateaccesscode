// Service worker: makes the app installable and shows push alerts.
// It deliberately does NOT cache anything: the app must always show live data (codes, approvals).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { title: "Lighthouse Lekki", body: event.data ? event.data.text() : "" };
  }
  const sos = d.kind === "sos";
  event.waitUntil(
    self.registration.showNotification(d.title || "Lighthouse Lekki", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || undefined,
      renotify: !!sos,
      requireInteraction: sos,
      vibrate: sos ? [400, 150, 400, 150, 400] : [120],
      data: { link: d.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(link).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
