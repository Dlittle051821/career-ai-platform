"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/config/site";
import { Container } from "@/components/layout/Container";
import { LanguageSelector } from "./LanguageSelector";
import { AccountMenu } from "./AccountMenu";
import { ExploreMenu } from "./ExploreMenu";
import { MobileNav } from "./MobileNav";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const NAV_LINK_CLASSES = "whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors";

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
        "sticky top-0 z-40 border-b bg-surface/95 backdrop-blur transition-shadow duration-200",
        scrolled ? "border-border shadow-soft" : "border-transparent"
      )}
    >
      <Container className="flex h-[4.5rem] items-center justify-between gap-2 py-3 xl:px-5">
        <Logo />

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center">
            <li>
              <ExploreMenu />
            </li>
            {PRIMARY_NAV.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      NAV_LINK_CLASSES,
                      isActive ? "bg-surface-alt text-primary" : "text-text-soft hover:bg-surface-alt hover:text-primary"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <LanguageSelector />
          <AccountMenu />
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
