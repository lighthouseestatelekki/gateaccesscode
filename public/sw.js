// Minimal service worker: makes the app installable and is where push notifications will be handled later.
// It deliberately does NOT cache anything: the app must always show live data (codes, approvals).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
