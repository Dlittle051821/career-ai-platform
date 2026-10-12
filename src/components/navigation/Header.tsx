"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { HOME_NAV_LINK, PRIMARY_NAV } from "@/config/site";
import { Container } from "@/components/layout/Container";
import { isNavLinkActive } from "@/lib/navigation/active-nav";
import { LanguageSelector } from "./LanguageSelector";
import { AccountMenu } from "./AccountMenu";
import { ExploreMenu } from "./ExploreMenu";
import { MobileNav } from "./MobileNav";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

/**
 * UX10A — restrained "Apple-like" active-nav treatment: active text reads
 * slightly stronger/darker (text-primary + font-semibold vs. the default
 * font-medium text-text-soft) and carries a small Nextwise-blue underline,
 * never a filled pill/background wash (that was the pre-UX10A treatment —
 * replaced here because the task's own brief explicitly asks for
 * something quieter: "Do NOT use a heavy navigation pill for every item").
 * The underline previews on hover too (scale-x-0 -> scale-x-100), so
 * hovering any item gives the same quiet, smooth 200ms feedback whether
 * or not it's the active route — never a sudden snap.
 *
 * UX10-H05B "EXACT TOP HOMEPAGE REFERENCE REPRODUCTION" — the reference
 * shows a search glyph between the primary nav and the language/account
 * group. Rather than fabricate a non-functional search widget (a standing
 * project rule), this links to /courses — `src/app/(site)/courses/page.tsx`
 * already runs a real server-side keyword search via its `q` searchParam
 * (`searchCourses()`), so the icon points at genuine, pre-existing search
 * functionality, not a decoration. `LanguageSelector` and `AccountMenu`'s
 * own established "Sign In"/"Get Started" labels (a documented UX03-04
 * sitewide decision) are intentionally left unchanged rather than renamed
 * to chase the reference's own "Log in"/"Get started" casing/wording —
 * see UX10-H05B_REFERENCE_AUDIT.md.
 */
const NAV_LINK_BASE =
  "group relative inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-2 text-sm transition-colors duration-200";

function NavUnderline({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-2.5 -bottom-px h-0.5 origin-center scale-x-0 rounded-full bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none",
        active ? "scale-x-100" : "group-hover:scale-x-100"
      )}
    />
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color] duration-200",
        scrolled
          ? "border-b border-border/70 bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <Container
        className={cn(
          "flex items-center justify-between gap-2 transition-[height] duration-200 xl:px-5",
          scrolled ? "h-16" : "h-[4.5rem]"
        )}
      >
        <Logo />

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center">
            <li>
              <Link
                href={HOME_NAV_LINK.href}
                aria-current={isNavLinkActive(pathname, HOME_NAV_LINK.href) ? "page" : undefined}
                className={cn(
                  NAV_LINK_BASE,
                  isNavLinkActive(pathname, HOME_NAV_LINK.href)
                    ? "font-semibold text-primary"
                    : "font-medium text-text-soft hover:text-primary"
                )}
              >
                {HOME_NAV_LINK.label}
                <NavUnderline active={isNavLinkActive(pathname, HOME_NAV_LINK.href)} />
              </Link>
            </li>
            <li>
              <ExploreMenu />
            </li>
            {PRIMARY_NAV.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(NAV_LINK_BASE, active ? "font-semibold text-primary" : "font-medium text-text-soft hover:text-primary")}
                  >
                    {link.label}
                    <NavUnderline active={active} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <Link
            href="/courses"
            aria-label="Search courses"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-soft transition-colors duration-200 hover:bg-surface-alt hover:text-primary"
          >
            <Search aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />
          </Link>
          <LanguageSelector />
          <AccountMenu />
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
