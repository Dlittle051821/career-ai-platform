import { redirect } from "next/navigation";

/**
 * NW03.3 — `/studio/career`.
 *
 * The Career Intelligence workspace already exists in full at `/dashboard`
 * (profile completion, invoices, agreements, saved items, applications,
 * discovery session, recommendation readiness, next-best-action, journey
 * progress, important dates — see docs/milestones/NW03/NW03_01_AUDIT.md
 * section 2). The brief's reuse-first instruction and the "do not fork
 * working functionality" principle both point the same way: `/studio/career`
 * redirects to that real, already-tested dashboard rather than duplicating
 * or re-skinning it. This keeps exactly one implementation of the Career
 * workspace, so NW03 cannot introduce a second, drifting copy of it.
 *
 * `/studio/career` itself is still a real, protected URL a visitor or a
 * post-registration redirect (see RegisterForm.tsx) can land on directly —
 * it just immediately hands off to the existing page.
 */
export default function StudioCareerPage() {
  redirect("/dashboard");
}
