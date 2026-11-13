"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_LINKS } from "@/config/site";
import { NextwiseBrandLogo } from "@/components/brand/NextwiseBrandLogo";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { AccountMenu } from "./AccountMenu";
import { WorkspaceEntryLink } from "./WorkspaceEntryLink";
import { MobileNav } from "./MobileNav";
import { NavMenus } from "./NavMenus";

/**
 * CIUX-01B — THE Nextwise header: one component for the homepage and every
 * public page, styled by one stylesheet (src/styles/site-header.css).
 *
 *   master logo · navigation capsule (NavMenus) · account actions · phone menu (MobileNav)
 *
 * context="home"  rendered by the approved V5.4 story (NextwiseV54Home) inside
 *                 its root; the homepage engine positions, scales and fades it
 *                 and switches it to the solid state as the story scrolls.
 * context="page"  rendered once by the (site) layout for every other public
 *                 page; same geometry (header-geometry.ts, set before first
 *                 paint), transparent at the top and the same solid state
 *                 once the page scrolls. Not rendered on the homepage.
 *
 * The visible differences between routes are only the active section, the
 * scroll state and the signed-in state — never a different design.
 */
export function SiteHeader({ context, rootId }: { context: "home" | "page"; rootId?: string }) {
  const pathname = usePathname();
  const solid = useScrolled(context === "page");
  if (context === "page" && pathname === "/") return null;

  return (
    <header
      className={context === "home" ? "v54-header nwh" : "nwh"}
      data-nwh-context={context}
      data-solid={solid ? "" : undefined}
      aria-label="Nextwise"
    >
      <Link href="/" className={context === "home" ? "v54-brand nwh-brand" : "nwh-brand"} aria-label="Nextwise home">
        <NextwiseBrandLogo variant="compact" tone="light" height={36} label="" priority />
      </Link>
      <NavMenus />
      <HeaderActions />
      <MobileNav rootId={rootId} />
    </header>
  );
}

/** The (site) layout's header for every public page except the homepage. */
export function Header() {
  return <SiteHeader context="page" />;
}

/**
 * Signed out (and until the first auth check resolves): "Log in" (quiet
 * outline) and "Sign up" (Electric Coral). Signed in: the role-aware
 * workspace (My Studio / Counsellor Workspace / Admin Studio) as the coral
 * pill, and the account menu. Same /login and /register routes; no auth
 * logic is changed here.
 */
function HeaderActions() {
  const { user, ready } = useAuthProfile();
  if (ready && user)
    return (
      <div className="nwh-actions">
        <WorkspaceEntryLink bare forceLabel className="nwh-signup" />
        <AccountMenu />
      </div>
    );
  return (
    <div className="nwh-actions">
      <Link href={AUTH_LINKS.login.href} className="v54-login nwh-login" data-v54-account="login">
        {AUTH_LINKS.login.label}
      </Link>
      <Link href={AUTH_LINKS.signup.href} className="v54-signup nwh-signup" data-v54-account="signup">
        {AUTH_LINKS.signup.label}
      </Link>
    </div>
  );
}

/** True once the page has scrolled past the top (page context only; the homepage engine drives its own state). */
function useScrolled(enabled: boolean) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  return scrolled;
}
