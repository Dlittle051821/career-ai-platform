/** CC-22B — route-level loading state for /dashboard (no fabricated counts while data loads). */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p role="status" aria-live="polite" className="sr-only">
        Loading your dashboard…
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-3">
        <div className="h-8 w-64 rounded bg-border" />
        <div className="h-4 w-96 max-w-full rounded bg-border" />
      </div>
      <div aria-hidden="true" className="h-40 animate-pulse rounded-[1.5rem] border border-border bg-surface-alt" />
      <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-alt" />
        ))}
      </div>
    </div>
  );
}
