import { ResidentTabs } from "@/components/lh/nav";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Bell, DoorOpen, LogIn, Megaphone, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Hero, Screen, Sheet } from "@/components/lh/ui";
import { useInbox, type Notice } from "@/lib/useInbox";
import { useMe } from "@/lib/useMe";
import { formatWhen } from "@/lib/when";
import { cn } from "@/lib/utils";

export const title = "Inbox";

const icons: Record<string, typeof Bell> = {
  announcement: Megaphone, code_in: LogIn, code_out: DoorOpen, code_refused: XCircle,
  code_switched_off: XCircle, approved: ShieldCheck, sos: ShieldAlert, security: ShieldAlert,
};
const tint: Record<string, string> = {
  announcement: "bg-gold-light text-gold-text", sos: "bg-destructive-light text-destructive",
  code_refused: "bg-destructive-light text-destructive", security: "bg-gold-light text-gold-text", code_switched_off: "bg-muted text-text-2",
};

function Row({ n }: { n: Notice }) {
  const Icon = icons[n.kind] ?? Bell;
  return (
    <li className="flex gap-3 py-4">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tint[n.kind] ?? "bg-mint-light text-deep")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-semibold leading-snug", !n.read_at && "text-deep")}>{n.title}</p>
          {!n.read_at && <span aria-label="New" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />}
        </div>
        {n.body && <p className="mt-0.5 whitespace-pre-line text-text-2">{n.body}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{formatWhen(n.created_at)}</p>
      </div>
    </li>
  );
}

function Inbox() {
  const me = useMe();
  const { items, unread, markAllRead } = useInbox(me?.id);
  const resident = me?.role === "resident";
  const back = me?.role === "guard" ? "/guard/verify" : me?.role === "estate_manager" ? "/manager/approvals" : "/home";

  // Opening the inbox counts as reading it.
  useEffect(() => {
    if (unread > 0) {
      const t = setTimeout(markAllRead, 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [unread, markAllRead]);

  return (
    <Screen>
      <Hero>
        {resident ? null : <Link to={back} aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>}
        <h1 className={resident ? "pt-2 text-3xl font-semibold" : "mt-4 text-3xl font-semibold"}>Inbox</h1>
        <p className="mt-1 text-deep-foreground/70">Announcements and updates about your codes.</p>
      </Hero>
      <Sheet>
        {items && items.length === 0 && <p className="rounded-lg bg-muted p-6 text-center text-text-2">Nothing here yet.</p>}
        <ul className="divide-y divide-border">{(items ?? []).map((n) => <Row key={n.id} n={n} />)}</ul>
      </Sheet>
      {resident && <ResidentTabs />}
    </Screen>
  );
}

export default Inbox;
