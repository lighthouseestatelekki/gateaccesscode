import { useState } from "react";
import { cn } from "@/lib/utils";

/*
 * Small, calm charts for phones. One series, one hue (the brand mint), thin columns with a
 * 4px rounded top and square base, hairline grid, a 2px gap between bars, tap/hover a bar to
 * read its value, and a "Show as table" switch so nothing depends on colour or on the picture.
 */

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export type Point = { label: string; long: string; n: number };

export function ColumnChart({ title, subtitle, points, unit = "entries", labelEvery = 1 }: { title: string; subtitle?: string; points: Point[]; unit?: string; labelEvery?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 320, H = 150, L = 26, B = 22, T = 8;
  const max = niceMax(Math.max(0, ...points.map((p) => p.n)));
  const band = (W - L) / points.length;
  const bw = Math.min(24, Math.max(4, band - 2));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const total = points.reduce((a, p) => a + p.n, 0);
  const shown = sel !== null ? points[sel] : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <button onClick={() => setTable(!table)} className="min-h-9 shrink-0 rounded-full bg-mint-lightest px-3 text-xs font-semibold text-text-2">{table ? "Show chart" : "Show as table"}</button>
      </div>
      <p aria-live="polite" className="mt-2 h-5 text-sm font-semibold text-foreground">
        {shown ? `${shown.long}: ${shown.n} ${unit}` : total === 0 ? `No ${unit} yet` : `Total ${compact(total)} ${unit} · tap a bar`}
      </p>
      {table ? (
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">When</th><th className="py-1 text-right font-medium">{unit[0]!.toUpperCase() + unit.slice(1)}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.long} className="border-t border-border"><td className="py-1.5">{p.long}</td><td className="py-1.5 text-right tabular-nums">{p.n}</td></tr>)}</tbody>
        </table>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${title}. ${points.map((p) => `${p.long} ${p.n}`).join(", ")}`} onMouseLeave={() => setSel(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{compact(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = L + band * i + band / 2;
            const top = y(p.n);
            const h = H - B - top;
            const r = Math.min(4, h, bw / 2);
            const x0 = cx - bw / 2, x1 = cx + bw / 2, base = H - B;
            const d = h <= 0 ? "" : `M${x0},${base} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${top + r} L${x1},${base} Z`;
            return (
              <g key={i} onMouseEnter={() => setSel(i)} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: "pointer" }}>
                <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" />
                {d && <path d={d} fill={sel === null || sel === i ? "var(--primary)" : "color-mix(in oklab, var(--primary) 45%, var(--card))"} />}
                {i % labelEvery === 0 && <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{p.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

/** Ranked list with a thin bar per row: "who / which house had the most". */
export function BarList({ title, subtitle, rows, unit = "entries", empty }: { title: string; subtitle?: string; rows: { label: string; n: number }[]; unit?: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-text-2">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-medium">{r.label}</span>
                <span className="shrink-0 tabular-nums text-text-2">{r.n} {r.n === 1 ? unit.replace(/ies$/, "y").replace(/s$/, "") : unit}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-mint-lightest">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatTile({ label, value, tone = "plain" }: { label: string; value: number | string; tone?: "plain" | "warn" }) {
  return (
    <div className={cn("rounded-lg px-3 py-3", tone === "warn" ? "bg-gold-light" : "bg-mint-lightest")}>
      <p className="font-display text-2xl font-bold text-foreground">{typeof value === "number" ? compact(value) : value}</p>
      <p className="text-xs font-semibold text-text-2">{label}</p>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayPoints(per: { day: string; n: number }[]): Point[] {
  return per.map((p) => {
    const d = new Date(`${p.day}T12:00:00Z`);
    return { label: String(d.getUTCDate()), long: `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, n: Number(p.n) };
  });
}

export function hourPoints(per: { hour: number; n: number }[]): Point[] {
  const name = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return per.map((p) => ({ label: name(p.hour), long: `${name(p.hour)}–${name((p.hour + 1) % 24)}`, n: Number(p.n) }));
}
