import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { getMyProductEntitlements } from "@/lib/products/entitlements";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

/**
 * NW03.3 — the Studio hub (`/studio`).
 *
 * The one shared landing point for a signed-in student choosing between
 * Nextwise's two independent product workspaces. Deliberately thin: no
 * product-specific data is fetched or shown here (that lives in each
 * workspace itself) — this page's only job is the choice, framed so
 * neither option reads as the "real" one or a prerequisite for the other,
 * per AC-04 ("a student must be able to use either product fully without
 * being forced through the other").
 *
 * The one piece of real data this page does fetch is each product's
 * entitlement status (`getMyProductEntitlements()`, NW03.4) — shown only
 * as an informational "Active plan" badge. It never hides, disables, or
 * gates either card: both "Open workspace" links work identically whether
 * or not the student has purchased anything for that product.
 */
export default async function StudioHubPage() {
  const [profile, entitlements] = await Promise.all([getCurrentProfile(), getMyProductEntitlements()]);
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-2 text-base text-muted">
          Nextwise runs two independent workspaces. Pick one — you can always switch, and using one never requires the other.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link href="/studio/career" className="group block">
          <Card className="flex h-full flex-col transition-shadow group-hover:shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Compass aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">Career Intelligence</h2>
              {entitlements.hasCareerEntitlement ? <Badge tone="success">Active plan</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Your career discovery, applications, counselling, and recommendations — the existing Nextwise dashboard.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark">
              Open workspace
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>

        <Link href="/studio/abroad" className="group block">
          <Card className="flex h-full flex-col transition-shadow group-hover:shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Globe2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">Nextwise Abroad</h2>
              {entitlements.hasAbroadEntitlement ? <Badge tone="success">Active plan</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              Your study-abroad workspace — saved countries and courses, with more to come.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark">
              Open workspace
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
