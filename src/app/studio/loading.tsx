/**
 * NW05.2 — route-level loading state for `/studio`.
 *
 * `/studio` fetches real, student-scoped data across several tables (see
 * `page.tsx`'s docblock) before it can render anything — this skeleton
 * covers that wait without ever showing a fabricated 0% or empty count,
 * which the brief explicitly forbids ("no misleading zero counts when a
 * query failed/is pending"). Mirrors the `animate-pulse` skeleton
 * convention already used by `src/app/(site)/applications/loading.tsx`
 * and `src/app/(site)/pricing/loading.tsx`, adapted to this page's own
 * `DashboardShell`-hosted layout (no `Section` wrapper here — that
 * component belongs to the public site chrome, not the authenticated
 * Studio shell).
 */
export default function StudioLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <p role="status" aria-live="polite" className="sr-only">
        Loading your Student Studio…
      </p>

      <div aria-hidden="true" className="animate-pulse space-y-3">
        <div className="h-8 w-64 rounded bg-border" />
        <div className="h-4 w-96 max-w-full rounded bg-border" />
      </div>

      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-alt" />
        ))}
      </div>

      <div aria-hidden="true" className="animate-pulse rounded-[1.5rem] border border-border bg-surface p-5 sm:p-7">
        <div className="h-5 w-40 rounded bg-border" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-alt" />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="h-36 animate-pulse rounded-[1.5rem] border border-primary/15 bg-surface-alt" />

      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-[1.5rem] border border-border bg-surface-alt" />
        ))}
      </div>
    </div>
  );
}
