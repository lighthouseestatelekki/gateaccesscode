export type Theme = "light" | "dark" | "auto";
const KEY = "lh.theme";
const mq = () => window.matchMedia?.("(prefers-color-scheme: dark)");

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "auto" ? t : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(t: Theme = getTheme()) {
  const dark = t === "dark" || (t === "auto" && !!mq()?.matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: applies for this visit only */
  }
  applyTheme(t);
}

// Follow the phone when set to "Match phone".
mq()?.addEventListener?.("change", () => getTheme() === "auto" && applyTheme());
