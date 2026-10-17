// Arabic for resident screens.
//
// How it works: the screens are written in English. When Arabic is on, a small watcher swaps each
// English piece of text on the page for its Arabic version from src/lib/ar.ts, and the page is laid out
// right-to-left. Guard and Estate Manager screens always stay in English.
// To fix a translation, edit src/lib/ar.ts only.
import { AR, AR_PATTERNS, AR_WORDS } from "@/lib/ar";

export type Lang = "en" | "ar";
const KEY = "lh.lang";

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/** Save the choice and reload, so every screen starts cleanly in the new language. */
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked */
  }
  window.location.reload();
}

const staffPage = (path: string) => /^\/(guard|manager)(\/|$)/.test(path);
const DATE_LIKE = /\d{1,2}:\d{2}\s?(AM|PM)|\b(Today|Yesterday|today|tomorrow|Until|until|From)\b/;

/** English text -> Arabic, or null if we have nothing for it. Keeps surrounding spaces. */
export function translate(text: string): string | null {
  const core = text.trim();
  if (!core || !/[A-Za-z]/.test(core)) return null;
  let out: string | null = AR[core] ?? null;
  if (out == null) {
    for (const [re, fn] of AR_PATTERNS) {
      const m = core.match(re);
      if (m) {
        out = fn(m);
        break;
      }
    }
  }
  if (out == null && DATE_LIKE.test(core)) {
    out = core.replace(/[A-Za-z]+/g, (w) => AR_WORDS[w] ?? w);
  }
  if (out == null || out === core) return null;
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  return lead + out + trail;
}

const ATTRS = ["placeholder", "aria-label", "title"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE"]);

function translateNode(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) {
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest("[data-no-translate]")) return;
    const v = n.nodeValue ?? "";
    const t = translate(v);
    if (t != null && t !== v) n.nodeValue = t;
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  if (SKIP.has(el.tagName) && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
  if (el.closest("[data-no-translate]")) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) {
      const t = translate(v);
      if (t != null && t !== v) el.setAttribute(a, t);
    }
  }
  if (SKIP.has(el.tagName)) return;
  el.childNodes.forEach(translateNode);
}

let observer: MutationObserver | null = null;

/** Turn Arabic on or off for the current page. Called on every route change. */
export function applyLang(path: string) {
  const ar = getLang() === "ar" && !staffPage(path);
  const html = document.documentElement;
  html.lang = ar ? "ar" : "en";
  html.dir = ar ? "rtl" : "ltr";
  if (!ar) {
    observer?.disconnect();
    observer = null;
    return;
  }
  translateNode(document.body);
  if (observer) return;
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") translateNode(m.target);
      else if (m.type === "attributes") translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}
