import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Inbox, KeyRound, Menu, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { setStaffChoice, type StaffKind } from "@/lib/entry";
import { useMe } from "@/lib/useMe";
import { useInbox } from "@/lib/useInbox";

/** Resident menu bar: Home · Codes · Staff · Inbox · More. */
export function ResidentTabs() {
  const path = useLocation().pathname;
  const me = useMe();
  const { unread } = useInbox(me?.id);
  const tabs = [
    { to: "/home", label: "Home", icon: Home, match: ["/home"] },
    { to: "/codes", label: "Codes", icon: KeyRound, match: ["/codes"] },
    { to: "/staff", label: "Staff", icon: Users, match: ["/staff"] },
    { to: "/inbox", label: "Inbox", icon: Inbox, match: ["/inbox"] },
    { to: "/more", label: "More", icon: Menu, match: ["/more", "/insights", "/hadith"] },
  ] as const;
  return (
    <nav aria-label="Main menu" className="sticky bottom-0 z-30 mt-auto grid grid-cols-5 border-t border-border bg-card/95 pt-1 backdrop-blur safe-bottom">
      {tabs.map((t) => {
        const on = t.match.some((m) => path.startsWith(m));
        const Icon = t.icon;
        return (
          <Link key={t.to} to={t.to} aria-current={on ? "page" : undefined} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", on ? "text-deep" : "text-muted-foreground")}>
            <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on && "bg-mint-light")}>
              <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
            </span>
            {t.label}
            {t.to === "/inbox" && unread > 0 && (
              <span aria-label={`${unread} new`} className="absolute left-1/2 top-0.5 ml-2 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-5 text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Small Guard / Estate Manager switch shown on the staff sign-in pages. */
export function StaffSwitch({ value }: { value: StaffKind }) {
  const nav = useNavigate();
  const opts: [StaffKind, string, string][] = [["guard", "Guard", "/guard/login"], ["manager", "Estate Manager", "/manager/login"]];
  return (
    <div role="tablist" aria-label="Staff type" className="inline-flex rounded-full bg-white/15 p-1">
      {opts.map(([k, label, to]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => value !== k && nav(to, { replace: true })}
          className={cn("min-h-9 rounded-full px-3.5 text-sm font-semibold", value === k ? "bg-white text-deep" : "text-white/85")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "Resident? Sign in here" link on staff pages. Forgets the staff choice for this phone. */
export function ResidentLink({ className }: { className?: string }) {
  return (
    <Link to="/login" onClick={() => setStaffChoice(null)} className={cn("inline-flex min-h-11 items-center text-sm font-semibold text-text-2 underline underline-offset-4", className)}>
      Resident? Go to resident sign-in
    </Link>
  );
}
