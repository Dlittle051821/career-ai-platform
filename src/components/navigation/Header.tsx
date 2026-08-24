"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PRIMARY_NAV, UTILITY_NAV } from "@/config/site";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { LanguageSelector } from "./LanguageSelector";
import { StudentLoginModal } from "./StudentLoginModal";
import { MobileNav } from "./MobileNav";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

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
        "sticky top-0 z-40 border-b bg-surface/95 backdrop-blur transition-shadow duration-200",
        scrolled ? "border-border shadow-soft" : "border-transparent"
      )}
    >
      <Container className="flex h-[4.5rem] items-center justify-between gap-2 py-3 xl:px-5">
        <Logo />

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center">
            {PRIMARY_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-text-soft transition-colors hover:bg-surface-alt hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {UTILITY_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-secondary-dark transition-colors hover:bg-secondary-light"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <LanguageSelector />
          <StudentLoginModal />
          <LinkButton href="/book-counselling" size="sm">
            Book free counselling
          </LinkButton>
        </div>

        <MobileNav primaryLinks={PRIMARY_NAV} utilityLinks={UTILITY_NAV} />
      </Container>
    </header>
  );
}
