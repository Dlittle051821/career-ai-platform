import { ShieldCheck, FileCheck2, UserCheck, Lock } from "lucide-react";

const TRUST_ITEMS = [
  { icon: FileCheck2, label: "Transparent Pricing", description: "Every price shown is final — no hidden fees." },
  { icon: ShieldCheck, label: "Clear Deliverables", description: "Every plan lists exactly what's included." },
  { icon: UserCheck, label: "Expert Counsellors", description: "Guidance from real, qualified counsellors." },
  { icon: Lock, label: "Secure Process", description: "Checkout and payments are handled securely." },
] as const;

/**
 * UX10-PR01 (visual base) / UX10-PR01B (visual correction) — the reference
 * mockup's compact reassurance strip below the plan cards. The brief is
 * explicit and repeated (UX10-PR01 sections 17/19, UX10-PR01B section 11):
 * no unverified claims like "10,000+ students", "95% visa success", or a
 * star rating unless backed by real, verified business data — none of that
 * exists in this codebase's data model, so this strip uses only the four
 * safe, truthful, already-real claims the brief itself suggests (every one
 * of them is simply a description of how NextWise's real, already-built
 * pricing/checkout system behaves, not a marketing statistic). UX10-PR01B
 * adds a one-line description per item (still no numbers/statistics) for a
 * more developed look, per that pass's own "visually underdeveloped" note.
 */
export function PricingTrustStrip() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {TRUST_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex flex-col items-center gap-2.5 rounded-2xl border border-border/80 bg-surface px-4 py-6 text-center shadow-[0_6px_18px_-10px_rgba(15,23,42,0.18)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-text">{item.label}</p>
            <p className="text-xs leading-relaxed text-muted">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
