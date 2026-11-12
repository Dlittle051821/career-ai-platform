import Link from "next/link";
import { ArrowRight, Mail, Phone, ShieldCheck } from "lucide-react";
import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_TAGLINE, CONTACT, CURRENT_YEAR, DISCOVERY_SESSION_CTA, FOOTER_NAV } from "@/config/site";
import { NextwiseBrandLogo } from "@/components/brand/NextwiseBrandLogo";

/**
 * CIUX-01 — the one global footer, on the homepage navy (#03045F).
 * Identity and the official contact details (src/config/contact.ts via
 * CONTACT: founder and co-founder e-mail, the official phone number, all as
 * working mailto:/tel: links), the grouped navigation (FOOTER_NAV), legal
 * links, the guidance disclaimer and copyright. No office address, hours or
 * response-time promise: none has been approved.
 */
export function Footer() {
  return (
    <footer className="ciux-footer bg-ink text-on-ink">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label="Nextwise home" className="inline-flex rounded-md">
              <NextwiseBrandLogo variant="horizontal" tone="dark" height={44} label="" />
            </Link>
            <p className="mt-5 text-[15px] leading-relaxed text-on-ink-muted">{BRAND_SHORT_DESCRIPTION}</p>

            <h2 className="mt-8 font-sans text-sm font-semibold tracking-normal text-on-ink">Contact Nextwise</h2>
            <ul className="mt-3 space-y-2.5 text-[15px]">
              {CONTACT.people.map((person) => (
                <li key={person.email}>
                  <a href={person.mailto} className="group inline-flex items-start gap-2.5 rounded-sm text-on-ink hover:text-[var(--brand-aqua)]">
                    <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-action)]" />
                    <span>
                      <span className="block text-xs text-on-ink-muted">{person.role}</span>
                      <span className="underline-offset-4 group-hover:underline">{person.email}</span>
                    </span>
                  </a>
                </li>
              ))}
              <li>
                <a href={CONTACT.phone.tel} className="group inline-flex items-start gap-2.5 rounded-sm text-on-ink hover:text-[var(--brand-aqua)]">
                  <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-action)]" />
                  <span>
                    <span className="block text-xs text-on-ink-muted">Phone</span>
                    <span className="underline-offset-4 group-hover:underline">{CONTACT.phone.display}</span>
                  </span>
                </a>
              </li>
            </ul>

            <Link
              href={DISCOVERY_SESSION_CTA.href}
              className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-action px-5 text-[15px] font-semibold text-on-action transition-[background-color,transform] duration-[var(--duration-base)] hover:-translate-y-px hover:bg-action-hover motion-reduce:transform-none"
            >
              {DISCOVERY_SESSION_CTA.label}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {Object.entries(FOOTER_NAV).map(([heading, links]) => (
              <nav aria-label={heading} key={heading}>
                <h2 className="font-sans text-sm font-semibold tracking-normal text-on-ink">{heading}</h2>
                <ul className="mt-4 space-y-1">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-[32px] items-center rounded-sm text-[14.5px] text-on-ink-muted underline-offset-4 transition-colors hover:text-on-ink hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/12 pt-6 text-[13px] text-on-ink-muted md:flex-row md:items-center md:justify-between">
          <p className="flex items-start gap-2 md:max-w-2xl">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {BRAND_NAME} provides guidance and support; final decisions and outcomes depend on student eligibility,
            institutions, authorities, and employers.
          </p>
          <p className="shrink-0">
            © {CURRENT_YEAR} {BRAND_NAME} · {BRAND_TAGLINE}
          </p>
        </div>
        <p className="mt-3 text-[13px] text-on-ink-muted">
          <a href={CONTACT.website.url} className="inline-flex min-h-6 items-center rounded-sm underline-offset-4 hover:text-on-ink hover:underline">
            {CONTACT.website.display}
          </a>
          <span aria-hidden="true"> · </span>
          English · ଓଡ଼ିଆ (Odia) coming soon
        </p>
      </div>
    </footer>
  );
}
