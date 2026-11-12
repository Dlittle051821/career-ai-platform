"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, ShieldCheck, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { isNavLinkActive } from "@/lib/navigation/active-nav";
import { cn } from "@/lib/utils";

/**
 * NW08.5 — public header's role-aware "workspace" entry point.
 *
 * The brief's navigation section asks for a distinct right-side slot,
 * separate from the account dropdown: "authenticated student = My Studio +
 * account menu; authenticated counsellor/admin = role-specific workspace
 * entry (server-verified permissions only, never inferred from untrusted
 * client state)." This renders nothing until a role is known, and then
 * shows exactly one link per role, deliberately chosen to be the role's
 * single best "workspace" entry point rather than every item AccountMenu's
 * own dropdown offers (a student's dropdown has Dashboard AND Payments; this
 * shows just "My Studio") — so this table is its own small, role-to-one-link
 * mapping, not a re-read of account-menu.ts's link lists. It must still
 * agree with account-menu.ts wherever the two describe the SAME destination
 * (the counsellor and admin entries here match account-menu.ts's
 * COUNSELLOR_LINKS/ADMIN_LINKS hrefs exactly) — kept in sync by hand since
 * the two files answer different questions (the full role-scoped menu vs.
 * one headline workspace link), not by import, which is why the NW08.5 fix
 * that moved counsellors from /admin to /counsellor (see account-menu.ts's
 * docblock) had to be applied here too.
 *
 * Reusing AccountMenu's own documented security boundary: `account_type` is
 * presentation/navigation only. It decides what this link SAYS and POINTS
 * AT, nothing more. Clicking through to /admin still passes through
 * getCurrentAdmin()/requireAdminPermission() and RLS, independently, every
 * time — a mis-set or stale `account_type` here cannot grant access to
 * anything; worst case it shows a link that then bounces to the real
 * access-denied screen, exactly like AccountMenu's own role links already
 * can. See src/lib/navigation/account-menu.ts's docblock for the full
 * explanation of why this presentation-layer-only model is safe.
 */
const WORKSPACE_LINKS: Record<string, { label: string; href: string; icon: LucideIcon }> = {
  student: { label: "My Studio", href: "/studio", icon: GraduationCap },
  counsellor: { label: "Counsellor Workspace", href: "/counsellor", icon: UserCog },
  admin: { label: "Admin Studio", href: "/admin", icon: ShieldCheck },
};

export function WorkspaceEntryLink({
  className,
  forceLabel = false,
}: {
  className?: string;
  /** MobileNav's drawer is always narrower than the `sm:` breakpoint, so the pill's default "icon-only below `sm:`" label behavior would hide the label entirely there — pass true to always render it. */
  forceLabel?: boolean;
}) {
  const { user, accountType, ready } = useAuthProfile();
  const pathname = usePathname();

  if (!ready || !user) return null;

  const entry = accountType ? WORKSPACE_LINKS[accountType] : undefined;
  if (!entry) return null;

  const { label, href, icon: Icon } = entry;
  const active = isNavLinkActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border px-3.5 text-sm font-semibold transition-colors duration-200",
        active ? "border-action bg-[var(--brand-coral-pale)] text-primary" : "border-primary/15 bg-surface text-primary hover:border-primary/35",
        className
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className={forceLabel ? undefined : "hidden sm:inline"}>{label}</span>
    </Link>
  );
}
