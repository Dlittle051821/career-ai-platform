import Link from "next/link";
import { Mail, MapPin, ShieldCheck } from "lucide-react";
import {
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
  CONTACT,
  CURRENT_YEAR,
  FOOTER_NAV,
  LANGUAGES,
} from "@/config/site";
import { Container } from "@/components/layout/Container";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-on-primary">
      <Container className="py-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div className="max-w-xs">
            <Logo onDark />
            <p className="mt-4 text-sm leading-relaxed text-on-primary-muted">{BRAND_SHORT_DESCRIPTION}</p>
            <p className="mt-5 flex items-start gap-2 text-sm text-on-primary-muted">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {CONTACT.cityStatement}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm text-on-primary-muted">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
              {CONTACT.emailLabel}
            </p>
            <p className="mt-3 text-xs text-on-primary-muted">
              {LANGUAGES.map((l) => l.nativeLabel).join(" | ")}
              {" "}
              — full ଓଡ଼ିଆ experience coming soon
            </p>
          </div>

          {Object.entries(FOOTER_NAV).map(([heading, links]) => (
            <nav aria-label={heading} key={heading}>
              <h2 className="text-sm font-semibold text-on-primary">{heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-on-primary-muted transition-colors hover:text-on-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-on-primary-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 sm:max-w-2xl">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {BRAND_NAME} provides guidance and support; final decisions and outcomes depend on student eligibility,
            institutions, authorities, and employers.
          </p>
          <p>
            © {CURRENT_YEAR} {BRAND_NAME}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
