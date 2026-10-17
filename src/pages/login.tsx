import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { HadithLine, Hero, Keypad, PinBoxes, Screen, Sheet, UnitPicker, usePin, Button } from "@/components/lh/ui";
import { supabase } from "@/lib/supabase";
import { pinSignIn } from "@/lib/staffAdmin";
import { unitToCode } from "@/lib/units";
import { UNITS } from "@/mock/data";

export const title = "Resident log in";

type House = { number: string; unit: string };
const KEY = "lh.house";

function loadHouse(): House | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as House) : null;
  } catch {
    return null;
  }
}
function saveHouse(h: House | null) {
  try {
    if (h) localStorage.setItem(KEY, JSON.stringify(h));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the resident just picks the house again next time */
  }
}

function Brand({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between">
      <span className="flex items-center gap-2 font-display text-base font-bold">
        <svg width="20" height="20" viewBox="0 0 26 26" aria-hidden className="text-gold">
          <path d="M10 24h6l-1.2-13h-3.6z" fill="currentColor" />
          <rect x="9.5" y="6" width="7" height="4" rx="1" fill="currentColor" />
          <path d="M13 2l3 4h-6z" fill="currentColor" />
        </svg>
        Lighthouse Lekki
      </span>
      {right}
    </div>
  );
}

/** Step 1 (first time, or after "Change house"): which house and unit. */
function PickHouse({ onDone }: { onDone: (h: House) => void }) {
  const num = usePin();
  const [unit, setUnit] = useState<string>(UNITS[0]);
  return (
    <Screen>
      <h1 className="sr-only">Resident log in</h1>
      <Hero>
        <Brand
          right={
            <Link to="/register" className="flex min-h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white">
              Register
            </Link>
          }
        />
        <p className="mt-6 text-sm text-deep-foreground/80">Assalam Alaekum · which house?</p>
        <p aria-live="polite" className="mt-1 flex h-20 items-end font-display text-8xl font-extrabold leading-[0.85] tracking-tight text-white">
          {num.value || <span className="pb-2 text-2xl font-bold text-deep-foreground/45">Tap your house number</span>}
        </p>
      </Hero>
      <Sheet className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-2">Unit</p>
          <UnitPicker value={unit} onChange={setUnit} options={UNITS} />
        </div>
        <Keypad onDigit={(d) => num.value.length < 3 && num.onDigit(d)} onBack={num.onBack} />
        <Button disabled={!num.value || num.value === "0"} onClick={() => onDone({ number: String(Number(num.value)), unit })}>
          Continue
        </Button>
      </Sheet>
    </Screen>
  );
}

/** Step 2: the house is the hero, PIN pad below. Signs in on the 6th digit. */
function EnterPin({ house, onChangeHouse }: { house: House; onChangeHouse: () => void }) {
  const nav = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const pin = usePin(async (thePin) => {
    setChecking(true);
    setError("");

    const cleanedHouse = String(Number(house.number.trim()));
    const unitCode = unitToCode(house.unit);

    const { data: signInData, error: signInError } = await pinSignIn({ kind: "resident", house_number: cleanedHouse, house_unit: unitCode, pin: thePin });

    if (signInError) {
      if (/invalid login credentials/i.test(signInError.message)) {
        setError("House number or PIN is incorrect.");
      } else {
        setError(signInError.message);
      }
      pin.reset();
      setChecking(false);
      return;
    }

    const user = signInData?.user;
    if (!user) {
      await supabase.auth.signOut();
      setError("We couldn't find your registration. Please contact the Estate Manager.");
      pin.reset();
      setChecking(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status,must_change_pin,full_name,house_number,house_unit")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "resident") {
      await supabase.auth.signOut();
      setError("We couldn't find your registration. Please contact the Estate Manager.");
      pin.reset();
      setChecking(false);
      return;
    }

    if (profile.status === "pending") {
      saveHouse(house);
      await supabase.auth.signOut();
      nav("/pending");
      return;
    }

    if (profile.status === "declined") {
      await supabase.auth.signOut();
      setError("Your registration was not approved. Please contact the Estate Manager.");
      pin.reset();
      setChecking(false);
      return;
    }

    if (profile.status === "suspended") {
      await supabase.auth.signOut();
      setError("Your account is suspended. Please contact the Estate Manager.");
      pin.reset();
      setChecking(false);
      return;
    }

    if (profile.status === "active" && profile.must_change_pin) {
      saveHouse(house);
      nav("/change-pin");
      return;
    }

    if (profile.status === "active") {
      saveHouse(house);
      nav("/home");
      return;
    }

    await supabase.auth.signOut();
    setError("We couldn't find your registration. Please contact the Estate Manager.");
    pin.reset();
    setChecking(false);
  });

  return (
    <Screen>
      <h1 className="sr-only">Resident log in</h1>
      <Hero className="pb-16">
        <Brand
          right={
            <button onClick={onChangeHouse} className="min-h-11 rounded-full bg-white/15 px-4 text-sm font-semibold text-white">
              Change house
            </button>
          }
        />
        <p className="mt-7 text-sm text-deep-foreground/80">Assalam Alaekum · signing in to</p>
        <p className="mt-1 font-display text-8xl font-extrabold leading-[0.85] tracking-tight text-white">{house.number}</p>
        <span className="mt-3 inline-flex rounded-full bg-gold px-3.5 py-1.5 text-sm font-bold text-deep-dark">{house.unit}</span>
      </Hero>
      <Sheet className="flex flex-col gap-5">
        <h2 className="text-center text-lg font-bold">{checking ? "Checking…" : "Enter your PIN"}</h2>
        <PinBoxes value={pin.value} />
        {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
        <Keypad
          onDigit={(d) => {
            if (checking) return;
            setError("");
            if (pin.value.length === 5) setChecking(true);
            pin.onDigit(d);
          }}
          onBack={() => {
            if (checking) return;
            pin.onBack();
          }}
        />
        <p className="text-center text-sm text-text-2">Signs you in on the 6th digit · Forgot your PIN? Ask the Estate Manager.</p>
        <HadithLine className="pt-1" />
      </Sheet>
    </Screen>
  );
}

function Login() {
  const nav = useNavigate();
  const [house, setHouse] = useState<House | null>(() => loadHouse());

  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!supabase.auth?.getSession) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role,status,must_change_pin,full_name,house_number,house_unit")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (!error && profile && profile.role === "resident" && profile.status === "active") {
        nav(profile.must_change_pin ? "/change-pin" : "/home", { replace: true });
      } else {
        await supabase.auth.signOut();
      }
    }
    checkSession();
    return () => {
      active = false;
    };
  }, [nav]);

  if (!house) return <PickHouse onDone={setHouse} />;
  return <EnterPin house={house} onChangeHouse={() => { saveHouse(null); setHouse(null); }} />;
}

export default Login;
