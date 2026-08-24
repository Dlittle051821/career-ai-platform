import { Check, X } from "lucide-react";
import type { PricingPackage } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/utils";

export function PricingCard({ pkg, highlight = false }: { pkg: PricingPackage; highlight?: boolean }) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        highlight ? "border-2 border-secondary shadow-lifted" : undefined
      )}
    >
      {highlight ? (
        <Badge tone="success" className="mb-4 self-start">
          Most chosen
        </Badge>
      ) : (
        <div className="mb-4 h-[26px]" aria-hidden="true" />
      )}
      <h3 className="text-xl font-semibold text-primary">{pkg.name}</h3>
      <p className="mt-1 text-sm text-muted">{pkg.tagline}</p>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-primary">{formatInr(pkg.price)}</span>
        <Badge tone="neutral">Sample price</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">Best for: {pkg.bestFor}</p>

      <ul className="mt-6 space-y-2.5 text-sm text-text-soft">
        {pkg.scope.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            {item}
          </li>
        ))}
        {pkg.notIncluded.map((item) => (
          <li key={item} className="flex items-start gap-2 text-muted">
            <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <LinkButton href="/book-counselling" variant={highlight ? "primary" : "outline"} className="w-full justify-center">
          Book free counselling
        </LinkButton>
      </div>
    </Card>
  );
}
