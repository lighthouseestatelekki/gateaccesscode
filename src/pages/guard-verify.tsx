import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Keypad, PinDigits } from "@/components/lh/guard";
import { usePin } from "@/components/lh/ui";

export const title = "Check code";

function Verify() {
  const nav = useNavigate();
  const pin = usePin((v) => {
    if (v[0] === "1") nav("/guard/verdict/access");
    else if (v[0] === "2") nav("/guard/verdict/expired");
    else nav("/guard/verdict/denied");
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

export default Verify;
