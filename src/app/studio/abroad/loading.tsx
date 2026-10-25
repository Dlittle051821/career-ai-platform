/**
 * NW05.5 — route-level loading state for `/studio/abroad`, mirroring
 * `src/app/studio/loading.tsx`'s own convention (see that file's docblock
 * for the full reasoning).
 */
export default function StudioAbroadLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <p role="status" aria-live="polite" className="sr-only">
        Loading your Nextwise Abroad workspace…
      </p>

      <div aria-hidden="true" className="animate-pulse space-y-3">
        <div className="h-8 w-56 rounded bg-border" />
        <div className="h-4 w-96 max-w-full rounded bg-border" />
      </div>

      <div aria-hidden="true" className="h-20 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-alt" />

      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-alt" />
        ))}
      </div>

      <div aria-hidden="true" className="h-64 animate-pulse rounded-[1.5rem] border border-border bg-surface-alt" />

      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-[1.5rem] border border-border bg-surface-alt" />
        ))}
      </div>
    </div>
  );
}
