import { Link } from "react-router-dom";
import { Clock, RotateCcw, Share2 } from "lucide-react";
import { formatCode, formatValidity } from "@/lib/expiry";
import { formatWhen } from "@/lib/when";
import { cn } from "@/lib/utils";

export type TicketRow = { id: string; code: string; holder_name: string; type: string; valid_from: string; valid_to: string; active: boolean; used_at: string | null; created_at: string };
export type TicketStatus = "Active" | "Used" | "Expired" | "Cancelled";

export const ticketStatus = (c: TicketRow, now: Date): TicketStatus =>
  c.used_at ? "Used" : !c.active ? "Cancelled" : new Date(c.valid_to).getTime() > now.getTime() ? "Active" : "Expired";

/** Soft, friendly colours for a person's initial. Same name, same colour, every time. */
const AVATARS = [
  "bg-[#DDF3E6] text-[#1A5A3E]",
  "bg-[#FBEFC4] text-[#7A5B05]",
  "bg-[#DCEBFA] text-[#1E4C7A]",
  "bg-[#F8E1DA] text-[#8A3A22]",
  "bg-[#E9E2F7] text-[#4D3A7A]",
];
export function avatarTone(name: string) {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length]!;
}
export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full font-display font-bold", avatarTone(name), className)}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

function timeLeft(to: Date, now: Date) {
  const mins = Math.max(0, Math.round((to.getTime() - now.getTime()) / 60000));
  if (mins < 60) return `${mins} min left`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? "" : "s"} left`;
  const days = Math.round(hrs / 24);
  return `${days} days left`;
}

const CHIP: Record<TicketStatus, string> = {
  Active: "bg-mint-light text-deep",
  Used: "bg-muted text-text-2",
  Cancelled: "bg-muted text-text-2",
  Expired: "bg-gold-light text-gold-text",
};
const DOT: Record<TicketStatus, string> = { Active: "bg-primary animate-pulse", Used: "bg-text-2/50", Cancelled: "bg-text-2/50", Expired: "bg-gold" };

/** An access code shown like a ticket: who, the code, how long it lasts, and what you can do with it. */
export function CodeTicket({
  c, now, onShare, onExtend, onCancel, showCreated,
}: {
  c: TicketRow; now: Date; onShare: () => void; onExtend?: () => void; onCancel?: () => void; showCreated?: boolean;
}) {
  const st = ticketStatus(c, now);
  const live = st === "Active";
  const from = new Date(c.valid_from).getTime();
  const to = new Date(c.valid_to);
  const span = Math.max(1, to.getTime() - from);
  const left = Math.min(1, Math.max(0, (to.getTime() - now.getTime()) / span));

  return (
    <li className={cn("relative overflow-hidden rounded-[22px] bg-card ring-1", live ? "ring-primary/25 shadow-[0_14px_32px_-22px_var(--deep)]" : "ring-border")}>
      <div className={cn("px-4 pb-4 pt-4", live && "bg-gradient-to-br from-mint-lightest to-card")}>
        <div className="flex items-center gap-3">
          <Initial name={c.holder_name} className={cn("size-10 text-base", !live && "opacity-60")} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{c.holder_name}</p>
            <p className="text-xs font-semibold text-muted-foreground">{c.type === "long_stay" ? "Long stay" : "One visit"}</p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", CHIP[st])}>
            <span className={cn("size-1.5 rounded-full", DOT[st])} />
            {st}
          </span>
        </div>
        <p className={cn("code-digits mt-3 text-[2.15rem] font-bold leading-none", live ? "text-deep" : "text-muted-foreground/70 line-through decoration-1")}>
          {formatCode(c.code)}
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-text-2">
          <Clock className="size-4 shrink-0" />
          <span className="truncate">{formatValidity(c, now)}</span>
          {live && <span className="ml-auto shrink-0 text-xs font-bold text-deep">{timeLeft(to, now)}</span>}
        </div>
        {live && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mint-light" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, left * 100)}%` }} />
          </div>
        )}
      </div>

      {/* tear line */}
      <div aria-hidden className="relative h-0">
        <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-card ring-1 ring-border" />
        <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-card ring-1 ring-border" />
        <div className="mx-4 border-t-2 border-dashed border-border" />
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        {live ? (
          <>
            <button onClick={onShare} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-deep px-4 text-sm font-bold text-deep-foreground">
              <Share2 className="size-4" /> Share
            </button>
            {onExtend && <button onClick={onExtend} className="min-h-11 rounded-full bg-mint-lightest px-4 text-sm font-semibold text-deep">Extend</button>}
            {onCancel && <button onClick={onCancel} className="min-h-11 rounded-full px-3 text-sm font-semibold text-destructive">Cancel</button>}
          </>
        ) : (
          <>
            <p className="flex-1 pl-1 text-xs text-muted-foreground">{showCreated ? `Created ${formatWhen(c.created_at)}` : st === "Used" ? "Visitor came in" : st === "Cancelled" ? "You cancelled this" : "Not used in time"}</p>
            <Link to="/create-code" state={{ holderName: c.holder_name }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mint-lightest px-4 text-sm font-semibold text-deep">
              <RotateCcw className="size-4" /> Create again
            </Link>
          </>
        )}
      </div>
      {live && showCreated && <p className="-mt-1 px-4 pb-3 text-xs text-muted-foreground">Created {formatWhen(c.created_at)}</p>}
    </li>
  );
}
