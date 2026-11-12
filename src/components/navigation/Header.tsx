"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { DISCOVERY_SESSION_CTA } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { NextwiseBrandLogo } from "@/components/brand/NextwiseBrandLogo";
import { AccountMenu } from "./AccountMenu";
import { WorkspaceEntryLink } from "./WorkspaceEntryLink";
import { MobileNav } from "./MobileNav";
import { NavMenus } from "./NavMenus";
import { cn } from "@/lib/utils";

/**
 * CIUX-01 — the site header for every public page except the homepage
 * (whose approved V5.4 scene renders its own header with the same NavMenus;
 * the site layout hides this one there).
 *
 * Mirrors the homepage header: master logo left, the grouped navigation
 * centred, account actions right ("Log in" quiet, "Sign up" Electric Coral;
 * signed in: My Studio + the account menu). "Book a free session" stays
 * visible from 1280 px and is the first item of the mobile menu below
 * 1024 px. Sticky: transparent at the top, frosted white with a hairline
 * once the page scrolls (the same 72 → 64 px settle as before).
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "ciux-header sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-[var(--duration-base)]",
        scrolled
          ? "border-b border-primary/10 bg-surface/90 shadow-[0_12px_32px_-24px_rgba(3,4,95,0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/80"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 px-4 transition-[height] duration-[var(--duration-base)] sm:px-6 lg:px-8",
          scrolled ? "h-16" : "h-[4.5rem]"
        )}
      >
        <Link href="/" aria-label="Nextwise home" className="flex shrink-0 items-center rounded-md">
          <NextwiseBrandLogo variant="compact" tone="light" height={34} label="" priority />
        </Link>

        <NavMenus />

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <LinkButton
            href={DISCOVERY_SESSION_CTA.href}
            variant="outline"
            size="sm"
            className="hidden xl:inline-flex"
            icon={<CalendarCheck aria-hidden="true" className="h-4 w-4" />}
          >
            {DISCOVERY_SESSION_CTA.label}
          </LinkButton>
          <WorkspaceEntryLink />
          <AccountMenu />
        </div>

        <MobileNav />
      </div>
    </header>
  );
}
