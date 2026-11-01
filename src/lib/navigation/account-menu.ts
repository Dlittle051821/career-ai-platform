/**
 * AccountMenu role-awareness — pure, framework-free logic.
 *
 * Bug being fixed: `src/components/navigation/AccountMenu.tsx` was
 * entirely student-oriented (always "Dashboard"/"Payments", no role label)
 * because its only client-side auth hook (`useAuthUser`,
 * ./use-auth-user.ts) never read `public.profiles.account_type` — it only
 * had the Supabase Auth user, which carries no role. This module is the new
 * single source of truth for turning an `account_type` value into what the
 * menu renders, kept separate from the component so it can be unit tested
 * without a React/DOM environment — same "pure lib vs I/O component" split
 * used throughout this codebase (e.g. src/lib/admin/status.ts,
 * src/lib/recommendations/readiness.ts, src/lib/profile-provenance/rules.ts).
 *
 * Source of truth here is `public.profiles.account_type` (see
 * supabase/migrations/0001_profiles.sql — a plain text column, default
 * 'student', no CHECK constraint), NOT `raw_user_meta_data`/
 * `raw_app_meta_data`, and NOT the separate `admin_roles` table.
 *
 * IMPORTANT — this is presentation/navigation only. It decides what a nav
 * link says and where it points, nothing more. It grants no access: every
 * /admin route is still independently gated by
 * getCurrentAdmin()/requireAdminPermission() (src/lib/supabase/admin-auth.ts)
 * and by RLS on every admin table (supabase/migrations/0004_admin_system.sql).
 * A `profiles.account_type` of "admin" with no corresponding `admin_roles`
 * row still lands on the access-denied screen in src/app/admin/layout.tsx —
 * nothing in this module can change that, by design.
 */

// ---------------------------------------------------------------------------
// Role label
// ---------------------------------------------------------------------------

/**
 * The only account_type values this app currently issues/expects — see
 * supabase/migrations/0001_profiles.sql (default 'student') and
 * docs/admin-system-guide.md §2 for `counsellor` as an existing admin_roles
 * value. Deliberately not inventing any value beyond what already exists.
 */
export const KNOWN_ACCOUNT_TYPES = ["student", "admin", "counsellor"] as const;
export type KnownAccountType = (typeof KNOWN_ACCOUNT_TYPES)[number];

export function isKnownAccountType(value: string | null | undefined): value is KnownAccountType {
  return typeof value === "string" && (KNOWN_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export const ACCOUNT_TYPE_LABELS: Record<KnownAccountType, string> = {
  student: "Student",
  admin: "Admin",
  counsellor: "Counsellor",
};

/**
 * Neutral fallback for when the role hasn't loaded yet, the profile row is
 * missing, or `account_type` holds a value this app doesn't recognize.
 * Never falls back to "Student" — an unrecognized role is not the same
 * thing as a known student, and silently treating it as one would be
 * exactly the class of bug this fix addresses.
 */
export const ACCOUNT_MENU_FALLBACK_LABEL = "Account";

export function resolveAccountMenuLabel(accountType: string | null | undefined): string {
  return isKnownAccountType(accountType) ? ACCOUNT_TYPE_LABELS[accountType] : ACCOUNT_MENU_FALLBACK_LABEL;
}

// ---------------------------------------------------------------------------
// Role-scoped links
// ---------------------------------------------------------------------------

export type AccountMenuLinkKind = "dashboard" | "payments" | "admin-dashboard" | "counsellor-workspace";

export interface AccountMenuLink {
  kind: AccountMenuLinkKind;
  label: string;
  href: string;
}

const STUDENT_LINKS: readonly AccountMenuLink[] = [
  { kind: "dashboard", label: "Dashboard", href: "/dashboard" },
  { kind: "payments", label: "Payments", href: "/payments" },
];

// /admin (src/app/admin/page.tsx) is the admin system's one real entry
// point — every module (students, leads, agreements, ...) is reached from
// inside it, so a single link is correct here, not a gap.
const ADMIN_LINKS: readonly AccountMenuLink[] = [
  { kind: "admin-dashboard", label: "Admin Dashboard", href: "/admin" },
];

// NW08.5 FIX — stale route. This used to point counsellors at /admin with a
// comment claiming "there is no separate /counsellor route in this
// codebase." That was true when this module was written but is stale now:
// NW07 built a genuinely separate, permission-gated Counsellor Studio at
// src/app/counsellor/** (its own layout.tsx gate — getCurrentAdmin() +
// hasPermission(admin.role, "counsellor-studio:read") — and its own
// CounsellorShell), discovered during this milestone's authenticated-area
// audit while re-verifying this exact claim against the current tree (the
// same "verify, don't just restate" discipline applied to sitemap.ts's own
// stale noindex comment — see NW085_01_PUBLIC_PAGE_AUDIT.md §5). Counsellors
// also retain real, scoped access to several /admin features (counsellors
// have specific ROLE_PERMISSIONS.counsellor entries in
// src/lib/admin/permissions.ts — counsellors:read, discovery-sessions,
// recommendation verification, document review, task management, plus
// counsellor-studio:read itself), so /admin is not WRONG for a counsellor to
// visit — but it is no longer their primary workspace, so this link (and
// WorkspaceEntryLink.tsx's matching entry, which must stay in sync) now
// points to their own studio instead.
const COUNSELLOR_LINKS: readonly AccountMenuLink[] = [
  { kind: "counsellor-workspace", label: "Counsellor Workspace", href: "/counsellor" },
];

/**
 * Role-scoped nav links for a signed-in user. An unrecognized/unloaded
 * account type gets no role-specific links at all — the caller (AccountMenu)
 * still renders its always-present items (Settings, Log out) around this,
 * but we don't guess a role's links for a role we can't identify.
 */
export function getAccountMenuLinks(accountType: string | null | undefined): readonly AccountMenuLink[] {
  switch (accountType) {
    case "student":
      return STUDENT_LINKS;
    case "admin":
      return ADMIN_LINKS;
    case "counsellor":
      return COUNSELLOR_LINKS;
    default:
      return [];
  }
}
