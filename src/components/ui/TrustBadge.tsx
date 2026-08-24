import { CheckCircle2, Clock, FileText, HelpCircle } from "lucide-react";
import type { TrustStatus } from "@/types";
import { Badge } from "./Badge";

const STATUS_CONFIG: Record<TrustStatus, { label: string; tone: "success" | "warning" | "info" | "neutral"; icon: typeof CheckCircle2 }> = {
  verified: { label: "Verified", tone: "success", icon: CheckCircle2 },
  pending: { label: "Pending verification", tone: "warning", icon: Clock },
  planned: { label: "Planned", tone: "info", icon: FileText },
  sample: { label: "Sample", tone: "neutral", icon: HelpCircle },
};

/**
 * Reusable status indicator for trust-sensitive claims. Defaults are
 * conservative on purpose: only pass status="verified" when the claim is
 * backed by real, owner-supplied documentation.
 */
export function TrustBadge({ status }: { status: TrustStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge tone={config.tone}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}
