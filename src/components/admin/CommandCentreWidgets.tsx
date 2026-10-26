import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/admin/money";
import type { CurrencyRevenueTrend, OperationalAlertInput } from "@/lib/admin/analytics";

/**
 * NW08.2 — presentational-only widgets for the redesigned /admin Command
 * Centre. Every number these render is passed in as a prop from a real,
 * already-computed aggregate in src/lib/supabase/admin/dashboard.ts — none
 * of these components fetch data or compute a figure of their own, and
 * none renders a hardcoded/example number. No charting dependency is
 * introduced (package.json has none — see NW08_01_ADMIN_AUDIT.md §7):
 * the revenue trend is plain inline SVG bars, and the service delivery
 * breakdown is a CSS conic-gradient ring plus a labeled legend, both
 * standard, broadly-supported, dependency-free techniques.
 */

const SEVERITY_BADGE_TONE: Record<OperationalAlertInput["severity"], "error" | "warning" | "info"> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

export function OperationalAlertsCard({ alerts }: { alerts: OperationalAlertInput[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface-alt/40 px-3 py-3 text-sm text-muted">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
        Nothing needs attention right now.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.id}>
          <Link
            href={a.href}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-sm transition-colors hover:border-secondary hover:bg-surface-alt/60"
          >
            <span className="flex min-w-0 items-center gap-2">
              {a.severity === "critical" ? <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-error" /> : null}
              <span className="truncate font-medium text-text">{a.label}</span>
            </span>
            <Badge tone={SEVERITY_BADGE_TONE[a.severity]} className="shrink-0">
              {a.count}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A compact, dependency-free bar chart. One series per currency (small multiples) rather than ever mixing currencies into one scale. */
export function RevenueTrendChart({ trend }: { trend: CurrencyRevenueTrend[] }) {
  if (trend.length === 0) {
    return <p className="text-sm text-muted">No recorded (paid) revenue in this window yet.</p>;
  }
  return (
    <div className="space-y-6">
      {trend.map((series) => {
        const max = Math.max(1, ...series.points.map((p) => p.amountMinorUnits));
        return (
          <div key={series.currency}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{series.currency}</p>
            <div className="mt-2 flex items-end gap-2" role="img" aria-label={`Monthly paid revenue in ${series.currency} for the last ${series.points.length} months`}>
              {series.points.map((p) => {
                const heightPercent = Math.round((p.amountMinorUnits / max) * 100);
                return (
                  <div key={p.periodStart} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-sm bg-secondary transition-[height]"
                        style={{ height: `${Math.max(heightPercent, p.amountMinorUnits > 0 ? 4 : 0)}%` }}
                        title={`${p.periodLabel}: ${formatMoney(p.amountMinorUnits, series.currency)}`}
                      />
                    </div>
                    <span className="text-[11px] text-muted">{p.periodLabel.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-text-soft">
              Latest month: <span className="font-medium text-text">{formatMoney(series.points[series.points.length - 1]?.amountMinorUnits ?? 0, series.currency)}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

const DONUT_COLORS = ["#2563EB", "#22C7F2", "#0B1F3A", "#64748B", "#94A3B8", "#38BDF8", "#1D4ED8", "#0E7490", "#475569", "#A5B4FC", "#CBD5E1"];

/** A CSS conic-gradient "donut" — no SVG path math, no dependency. Slices with 0 count contribute no arc length but still appear in the legend at 0, so a stage is never silently dropped from view. */
export function ServiceDeliveryDonut({
  breakdown,
}: {
  breakdown: { stage: string; label: string; count: number; sharePercent: number | null }[];
}) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted">No student outcome records yet — this breakdown fills in as students progress through the journey.</p>;
  }

  let cumulativePercent = 0;
  const stops: string[] = [];
  breakdown.forEach((b, i) => {
    if (b.count === 0) return;
    const start = cumulativePercent;
    const sharePercent = (b.count / total) * 100;
    cumulativePercent += sharePercent;
    stops.push(`${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${cumulativePercent}%`);
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div
        role="img"
        aria-label="Student distribution across the counselling and application journey"
        className="relative h-32 w-32 shrink-0 rounded-full"
        style={{ background: gradient }}
      >
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-surface text-center">
          <span className="text-lg font-semibold text-primary">{total}</span>
          <span className="text-[10px] text-muted">students</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {breakdown
          .filter((b) => b.count > 0)
          .map((b, i) => (
            <li key={b.stage} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[breakdown.indexOf(b) % DONUT_COLORS.length] }} />
                <span className="truncate text-text-soft">{b.label}</span>
              </span>
              <span className="shrink-0 text-muted">
                {b.count} {b.sharePercent !== null ? `(${b.sharePercent}%)` : ""}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
