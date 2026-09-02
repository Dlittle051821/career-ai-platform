"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Landmark,
  GraduationCap,
  ClipboardList,
  Contact,
  Wallet,
  Signature,
  UserCog,
  ChartColumn,
  FileText,
  ScrollText,
  Menu,
  X,
  LogOut,
  Shield,
  ChevronRight,
  Receipt,
  RotateCcw,
  Webhook,
  Settings2,
  Upload,
  GitMerge,
  ShieldCheck,
  Link2,
  Tag,
  CalendarHeart,
} from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { ADMIN_ROLE_LABELS, type CurrentAdmin } from "@/types/admin";
import { hasPermission, type AdminPermission } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/navigation/Logo";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
}

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard:read" },
  { label: "Students", href: "/admin/students", icon: Users, permission: "students:read" },
  { label: "Universities", href: "/admin/universities", icon: Landmark, permission: "universities:read" },
  { label: "Courses", href: "/admin/courses", icon: GraduationCap, permission: "courses:read" },
  { label: "Data Imports", href: "/admin/education/imports", icon: Upload, permission: "education-imports:read" },
  { label: "Duplicates", href: "/admin/education/duplicates", icon: GitMerge, permission: "education-duplicates:read" },
  { label: "Data Quality", href: "/admin/education/data-quality", icon: ShieldCheck, permission: "education-data-quality:read" },
  { label: "Sources", href: "/admin/education/sources", icon: Link2, permission: "education-sources:read" },
  { label: "Applications", href: "/admin/applications", icon: ClipboardList, permission: "applications:read" },
  { label: "Leads", href: "/admin/leads", icon: Contact, permission: "leads:read" },
  { label: "Discovery Sessions", href: "/admin/discovery-sessions", icon: CalendarHeart, permission: "discovery-sessions:read" },
  { label: "Pricing", href: "/admin/pricing", icon: Tag, permission: "pricing:read" },
  { label: "Payments", href: "/admin/payments", icon: Wallet, permission: "payments:read" },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt, permission: "invoices:read" },
  { label: "Refunds", href: "/admin/refunds", icon: RotateCcw, permission: "refunds:read" },
  { label: "Payment Events", href: "/admin/payment-events", icon: Webhook, permission: "payment-events:read" },
  { label: "Billing Settings", href: "/admin/billing-settings", icon: Settings2, permission: "billing-settings:read" },
  { label: "Agreements", href: "/admin/agreements", icon: Signature, permission: "agreements:read" },
  { label: "Counsellors", href: "/admin/counsellors", icon: UserCog, permission: "counsellors:read" },
  { label: "Analytics", href: "/admin/analytics", icon: ChartColumn, permission: "analytics:read" },
  { label: "Content", href: "/admin/content", icon: FileText, permission: "content:read" },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText, permission: "audit:read" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbLabelFor(segment: string): string {
  // A raw id segment (uuid-ish or "new") gets a generic label rather than
  // showing a long opaque id in the breadcrumb trail.
  if (segment === "new") return "New";
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return "Detail";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function NavLinks({ role, onNavigate }: { role: CurrentAdmin["role"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin modules" className="flex flex-col gap-0.5">
      {ADMIN_NAV.filter((item) => hasPermission(role, item.permission)).map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-on-primary" : "text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ admin, children }: { admin: CurrentAdmin; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile nav whenever the route changes — adjust state during
  // render rather than in an effect (matches AccountMenu.tsx's pattern),
  // per https://react.dev/learn/you-might-not-need-an-effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  const segments = pathname.split("/").filter(Boolean).slice(1); // drop leading "admin"
  const crumbs = [
    { label: "Admin", href: "/admin" },
    ...segments.map((seg, i) => ({
      label: crumbLabelFor(seg),
      href: i === segments.length - 1 ? undefined : `/admin/${segments.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-primary lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <Logo onDark />
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-muted">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks role={admin.role} />
        </div>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium text-on-primary">{admin.email ?? "Admin"}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-on-primary-muted">
            <Shield aria-hidden="true" className="h-3.5 w-3.5" />
            {ADMIN_ROLE_LABELS[admin.role]}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <div className="relative flex w-72 max-w-[85vw] flex-col bg-primary shadow-lifted">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <Logo onDark />
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-muted">
                  Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks role={admin.role} onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <div className="border-t border-white/10 p-4">
              <p className="truncate text-sm font-medium text-on-primary">{admin.email ?? "Admin"}</p>
              <p className="mt-0.5 text-xs text-on-primary-muted">{ADMIN_ROLE_LABELS[admin.role]}</p>
              <form action={logout} className="mt-3">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-on-primary-muted hover:bg-white/10 hover:text-on-primary"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open admin menu"
            className="rounded-md p-2 text-text-soft hover:bg-surface-alt lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-x-auto">
            <ol className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="hover:text-primary">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? "font-medium text-text" : undefined} aria-current={isLast ? "page" : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!isLast ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
                  </li>
                );
              })}
            </ol>
          </nav>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface-alt px-2.5 py-1 text-xs font-medium text-text-soft sm:flex">
            <Shield aria-hidden="true" className="h-3.5 w-3.5" />
            {ADMIN_ROLE_LABELS[admin.role]}
          </span>
        </header>

        <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
