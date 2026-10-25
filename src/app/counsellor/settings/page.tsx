import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { ADMIN_ROLE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Settings" };

/**
 * NW07 — a deliberately minimal, read-only Settings page. getCurrentAdmin()
 * is the only read here: getCounsellorById() (src/lib/supabase/admin/
 * counsellors.ts) requires "counsellors:read", a permission the
 * `counsellor` role does not hold even for their OWN counsellor record
 * (src/lib/admin/permissions.ts — see getCounsellorDashboardData()'s own
 * comment on the same restriction), so this page never attempts it.
 * Counsellor-profile editing (display name, bio, specializations) is an
 * admin-only action today; this page states that plainly rather than
 * rendering a form that would fail on submit.
 */
export default async function CounsellorSettingsPage() {
  const admin = await getCurrentAdmin();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Studio</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Settings</h1>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-primary">Your account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-0.5 text-sm text-text">{admin?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Role</dt>
            <dd className="mt-0.5 text-sm text-text">{admin ? ADMIN_ROLE_LABELS[admin.role] : "—"}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-muted">
          Your counsellor profile (display name, bio, specializations) is managed by an administrator. Contact your
          Nextwise admin to update it.
        </p>
      </Card>
    </div>
  );
}
