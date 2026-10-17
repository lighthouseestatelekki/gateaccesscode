// Remembers the browser's "install this app" offer (Android/Chrome) so a button can show it later.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
  });
}

/** True when the app is already opened from the Home Screen. */
export function isInstalled(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Shows the native install prompt if the browser offered one. Returns false if not available (e.g. iPhone). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  return true;
}
