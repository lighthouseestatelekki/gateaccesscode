import { Link, useRouterState } from "@tanstack/react-router";
import { Delete, ChevronDown, X } from "lucide-react";
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { hadith } from "@/mock/hadith";
import { cn } from "@/lib/utils";

export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} · Lighthouse Lekki` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · Lighthouse Lekki` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background", className)}>{children}</div>;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="text-gold">
        <path d="M10 24h6l-1.2-13h-3.6z" fill="currentColor" />
        <rect x="9.5" y="6" width="7" height="4" rx="1" fill="currentColor" />
        <path d="M13 2l3 4h-6z" fill="currentColor" />
        <path d="M18 7.5l6-2.5M18 8.5l6 2.5M8 7.5L2 5M8 8.5L2 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">Lighthouse Lekki</span>
    </div>
  );
}

export function Hero({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={cn("hero px-5 pb-12", className)}>{children}</header>;
}

export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("sheet flex-1 px-5 pt-7", className)}>{children}</main>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" };
const btn = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_10px_24px_-12px_var(--primary)]",
  secondary: "bg-mint-light text-deep hover:bg-mint-light/70",
  outline: "border border-border bg-card text-foreground hover:bg-mint-lightest",
  ghost: "text-deep hover:bg-mint-lightest",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};
export function btnClass(variant: keyof typeof btn = "primary", className?: string) {
  return cn("inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors active:scale-[0.99] disabled:opacity-40", btn[variant], className);
}
export function Button({ variant = "primary", className, ...p }: BtnProps) {
  return <button {...p} className={btnClass(variant, className)} />;
}

export function Field({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-2">{label}</span>
      <input {...p} className="h-13 min-h-12 w-full rounded-sm border border-border bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
    </label>
  );
}

export function SelectField({ label, options }: { label: string; options: readonly string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-2">{label}</span>
      <div className="relative">
        <select className="h-12 w-full appearance-none rounded-sm border border-border bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-5 text-muted-foreground" />
      </div>
    </label>
  );
}

export function PinBoxes({ value, size = "md", tone = "light" }: { value: string; size?: "md" | "lg"; tone?: "light" | "dark" }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`${value.length} of 6 digits entered`}>
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center rounded-full border-2 transition-all",
              size === "lg" ? "size-13 min-h-12 min-w-12" : "size-11",
              tone === "dark" ? "border-deep-foreground/25" : "border-border bg-mint-lightest",
              filled && (tone === "dark" ? "border-primary bg-primary/20" : "border-primary bg-mint-light"),
              active && "border-primary",
            )}
          >
            {filled && <span className={cn("rounded-full", size === "lg" ? "size-3.5" : "size-3", tone === "dark" ? "bg-deep-foreground" : "bg-deep")} />}
          </div>
        );
      })}
    </div>
  );
}

export function Keypad({ onDigit, onBack, tone = "light", big }: { onDigit: (d: string) => void; onBack: () => void; tone?: "light" | "dark"; big?: boolean }) {
  const key = cn(
    "flex items-center justify-center rounded-lg font-display font-medium transition-colors active:scale-95",
    big ? "h-18 min-h-16 text-3xl" : "h-14 text-2xl",
    tone === "dark" ? "bg-deep-mid text-deep-foreground active:bg-deep-dark" : "bg-mint-lightest text-deep active:bg-mint-light",
  );
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <span />
      <button type="button" className={key} onClick={() => onDigit("0")}>0</button>
      <button type="button" aria-label="Delete" className={cn(key, "bg-transparent")} onClick={onBack}>
        <Delete className="size-7" />
      </button>
    </div>
  );
}

export function usePin(onComplete?: (v: string) => void) {
  const [value, setValue] = useState("");
  return {
    value,
    reset: () => setValue(""),
    onDigit: (d: string) =>
      setValue((v) => {
        if (v.length >= 6) return v;
        const n = v + d;
        if (n.length === 6 && onComplete) setTimeout(() => onComplete(n), 180);
        return n;
      }),
    onBack: () => setValue((v) => v.slice(0, -1)),
  };
}

export function PinEntry({ label, hint }: { label: string; hint?: string }) {
  const pin = usePin();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-text-2">{label}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <PinBoxes value={pin.value} />
      <Keypad onDigit={pin.onDigit} onBack={pin.onBack} />
    </div>
  );
}

export function HadithLine({ className }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Math.random() * hadith.length));
    const t = setInterval(() => setI((x) => (x + 1) % hadith.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <p key={i} className={cn("animate-in fade-in duration-700 text-center text-sm italic leading-relaxed text-muted-foreground", className)}>
      “{hadith[i].text}”
    </p>
  );
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-deep-dark/50 animate-in fade-in" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-sheet bg-card px-5 pt-3 safe-bottom animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-muted"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusChip({ status }: { status: "Active" | "Used" | "Expired" }) {
  const c = { Active: "bg-mint-light text-deep", Used: "bg-muted text-text-2", Expired: "bg-gold-light text-gold-text" }[status];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", c)}>{status}</span>;
}

export function ManagerTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/manager/approvals", label: "Approvals" },
    { to: "/manager/residents", label: "Residents" },
    { to: "/manager/guards", label: "Guards" },
  ] as const;
  return (
    <nav className="sticky bottom-0 mt-auto grid grid-cols-3 border-t border-border bg-card safe-bottom pt-1">
      {tabs.map((t) => {
        const on = path.startsWith(t.to);
        return (
          <Link key={t.to} to={t.to} className={cn("flex min-h-14 flex-col items-center justify-center text-sm font-semibold", on ? "text-deep" : "text-muted-foreground")}>
            <span className={cn("mb-1 h-1 w-8 rounded-full", on ? "bg-primary" : "bg-transparent")} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
