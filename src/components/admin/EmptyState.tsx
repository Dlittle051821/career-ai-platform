import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Shared empty-state card for every admin list page — a real empty
 * database (spec: "the admin UI must also work correctly with zero
 * operational records") should look intentional, not broken.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      {/* UX09 — a circular tone-matched backdrop behind the icon, instead of
          the icon floating alone on white. Purely CSS (no new asset, no new
          dependency); decorative, so the icon itself stays aria-hidden and
          the card's own heading/description remain the accessible content. */}
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt">
        <Icon aria-hidden="true" className="h-8 w-8 text-muted" />
      </span>
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </Card>
  );
}
