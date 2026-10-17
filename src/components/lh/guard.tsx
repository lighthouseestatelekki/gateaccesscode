import { Link, useNavigate } from "react-router-dom";
import { Check, Clock, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { btnClass } from "./ui";

export { Keypad } from "./ui";

export function PinDigits({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn("flex h-16 w-12 items-center justify-center rounded-sm border-2 font-mono text-4xl font-bold", i < value.length ? "border-primary bg-deep-mid" : i === value.length ? "border-gold" : "border-deep-foreground/20")}>
          {value[i] ?? ""}
        </div>
      ))}
    </div>
  );
}

const tones = {
  access: "bg-primary text-primary-foreground",
  expired: "bg-gold text-deep-dark",
  denied: "bg-destructive text-destructive-foreground",
};

export function Verdict({ tone, title, children }: { tone: keyof typeof tones; title: string; children: ReactNode }) {
  const nav = useNavigate();
  const [n, setN] = useState(4);
  useEffect(() => {
    if (n <= 0) {
      nav("/guard/verify");
      return;
    }
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n, nav]);
  return (
    <div className={cn("flex min-h-dvh flex-col items-center px-6 text-center safe-top safe-bottom animate-in fade-in zoom-in-95 duration-200", tones[tone])}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-6 flex size-32 items-center justify-center rounded-full border-[6px] border-current/50 bg-black/10">
          <span aria-hidden className="absolute inset-0 rounded-full bg-current/20 motion-safe:animate-ping" />
          {tone === "access" ? <Check className="relative size-16" strokeWidth={3.5} /> : tone === "expired" ? <Clock className="relative size-16" strokeWidth={3} /> : <X className="relative size-16" strokeWidth={3.5} />}
        </div>
        <h1 className="text-[clamp(4rem,22vw,7rem)] font-extrabold leading-none tracking-tight">{title}</h1>
        <div className="mt-6 space-y-2">{children}</div>
      </div>
      <div className="w-full max-w-md space-y-3">
        <p className="text-base font-medium opacity-80">Next code in {n}s</p>
        <Link to="/guard/verify" className={btnClass("outline", "min-h-18 h-18 border-0 text-xl text-deep")}>Next code</Link>
      </div>
    </div>
  );
}
