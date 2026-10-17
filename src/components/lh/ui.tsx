import { Link, useLocation } from "react-router-dom";
import { Delete, ChevronDown, X } from "lucide-react";
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { hadith, HADITH_ATTRIBUTION } from "@/mock/hadith";
import { cn } from "@/lib/utils";

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
      <span className="whitespace-nowrap font-display text-[15px] font-extrabold uppercase tracking-[0.12em]">Lighthouse Estate</span>
    </div>
  );
}

export function Hero({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={cn("hero px-5 pb-14", className)}>{children}</header>;
}

export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("sheet flex-1 px-5 pt-3", className)}><div aria-hidden className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-border" />{children}</main>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "gold" | "secondary" | "ghost" | "danger" | "outline" };
const btn = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_10px_24px_-12px_var(--primary)]",
  gold: "bg-gold text-deep-dark font-bold hover:brightness-95 shadow-[0_14px_30px_-14px_var(--gold)]",
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

export function Field({ label, tone = "light", ...p }: { label: string; tone?: "light" | "dark" } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className={cn("mb-1.5 block text-sm font-medium", tone === "dark" ? "text-deep-foreground/70" : "text-text-2")}>{label}</span>
      <input {...p} className={cn("h-13 min-h-12 w-full rounded-2xl border-[1.5px] px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15", tone === "dark" ? "border-deep-foreground/20 bg-deep-mid text-deep-foreground placeholder:text-deep-foreground/40" : "border-border bg-card text-foreground")} />
    </label>
  );
}

export function SelectField({ label, options, ...p }: { label: string; options: readonly string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-2">{label}</span>
      <div className="relative">
        <select {...p} className="h-13 min-h-12 w-full appearance-none rounded-2xl border-[1.5px] border-border bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-5 text-muted-foreground" />
      </div>
    </label>
  );
}

export function PinBoxes({ value, size = "md", tone = "light" }: { value: string; size?: "md" | "lg"; tone?: "light" | "dark" }) {
  return (
    <div className="flex h-6 items-center justify-center gap-4" aria-label={`${value.length} of 6 digits entered`}>
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = i < value.length;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full transition-all duration-150",
              size === "lg" ? "size-4.5" : "size-3.5",
              filled ? "scale-125 bg-primary" : tone === "dark" ? "bg-deep-foreground/25" : "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

export function Keypad({ onDigit, onBack, tone = "light", big }: { onDigit: (d: string) => void; onBack: () => void; tone?: "light" | "dark"; big?: boolean }) {
  const key = cn(
    "flex items-center justify-center rounded-[18px] font-display font-bold transition-colors active:scale-95",
    big ? "h-18 min-h-16 text-3xl" : "h-14 text-2xl",
    tone === "dark" ? "bg-deep-mid text-deep-foreground active:bg-primary" : "bg-muted text-deep active:bg-primary active:text-primary-foreground",
  );
  return (
    <div className="grid grid-cols-3 gap-2">
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

export function UnitPicker({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div role="radiogroup" aria-label="Unit" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn("min-h-11 rounded-full px-4 text-sm font-semibold transition-colors", value === o ? "bg-deep text-deep-foreground" : "bg-mint-lightest text-text-2")}
        >
          {o}
        </button>
      ))}
    </div>
  );
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
    <div className={cn("text-center text-muted-foreground", className)}>
      <p key={i} className="animate-in fade-in duration-700 text-sm italic leading-relaxed">“{hadith[i]?.text}”</p>
      <p className="mt-2 text-xs leading-relaxed">{HADITH_ATTRIBUTION}</p>
    </div>
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

export function StatusChip({ status }: { status: "Active" | "Used" | "Expired" | "Cancelled" }) {
  const c = { Active: "bg-mint-light text-deep", Used: "bg-muted text-text-2", Cancelled: "bg-muted text-text-2", Expired: "bg-gold-light text-gold-text" }[status];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", c)}>{status}</span>;
}

export function ManagerTabs() {
  const path = useLocation().pathname;
  const tabs = [
    { to: "/manager/approvals", label: "Approvals" },
    { to: "/manager/residents", label: "Residents" },
    { to: "/manager/guards", label: "Guards" },
    { to: "/manager/gate-log", label: "Gate log" },
    { to: "/manager/more", label: "More" },
  ] as const;
  return (
    <nav className="sticky bottom-0 mt-auto grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur safe-bottom pt-1">
      {tabs.map((t) => {
        const on = path.startsWith(t.to) || (t.to === "/manager/more" && /^\/manager\/(insights|announce)/.test(path));
        return (
          <Link key={t.to} to={t.to} className={cn("flex min-h-14 flex-col items-center justify-center text-[13px] font-semibold", on ? "text-deep" : "text-muted-foreground")}>
            <span className={cn("mb-1 h-1 w-8 rounded-full", on ? "bg-primary" : "bg-transparent")} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
