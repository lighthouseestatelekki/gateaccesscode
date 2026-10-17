import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Keypad, meta, PinDigits } from "@/components/lh/guard";
import { usePin } from "@/components/lh/ui";

export const Route = createFileRoute("/guard/verify")({
  head: () => meta("Check code", "Enter a visitor's 6-digit code."),
  component: Verify,
});

function Verify() {
  const nav = useNavigate();
  const pin = usePin((v) => {
    if (v[0] === "1") nav({ to: "/guard/verdict/access" });
    else if (v[0] === "2") nav({ to: "/guard/verdict/expired" });
    else nav({ to: "/guard/verdict/denied" });
  });
  return (
    <div className="hero mx-auto flex min-h-dvh max-w-md flex-col px-5 safe-bottom">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold">Gate 1 · Guard 7</p>
        <Link to="/guard/login" aria-label="Sign out" className="-mr-2 flex size-11 items-center justify-center rounded-full text-deep-foreground/70"><LogOut className="size-5" /></Link>
      </div>
      <p className="mt-10 text-center text-lg text-deep-foreground/70">Enter visitor code</p>
      <div className="mt-5"><PinDigits value={pin.value} /></div>
      <div className="mt-auto pt-10"><Keypad onDigit={pin.onDigit} onBack={pin.onBack} tone="dark" big /></div>
    </div>
  );
}
