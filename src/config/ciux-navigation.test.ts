import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT_PEOPLE, OFFICIAL_CONTACT } from "@/config/contact";
import {
  CONTACT,
  DISCOVERY_SESSION_CTA,
  FOOTER_NAV,
  HEADER_DIRECT_LINKS,
  HEADER_LEADING_LINKS,
  HEADER_NAV_HREFS,
  MAIN_NAV_ITEMS,
  NAV_GROUPS,
} from "@/config/site";
import { buttonClasses, type ButtonVariant } from "@/components/ui/Button";

/**
 * CIUX-01 — guards for the global UX foundation: the official contact
 * details, the grouped navigation, and the shared button system.
 */

const SRC = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** True when an App Router page exists for this public path (any route group). */
function routeExists(href: string): boolean {
  const clean = href.split(/[?#]/)[0].replace(/^\//, "");
  const app = path.join(SRC, "app");
  const groups = readdirSync(app).filter((d) => d.startsWith("(") && statSync(path.join(app, d)).isDirectory());
  return [app, ...groups.map((g) => path.join(app, g))].some((base) =>
    ["page.tsx", "page.ts"].some((f) => existsSync(path.join(base, clean, f)))
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("CIUX-01 official contact details (src/config/contact.ts)", () => {
  it("holds exactly the approved values", () => {
    expect(OFFICIAL_CONTACT.founder.email).toBe("founder@nextwise.com");
    expect(OFFICIAL_CONTACT.coFounder.email).toBe("co-founder@nextwise.com");
    expect(OFFICIAL_CONTACT.phone.display).toBe("+91 7205 7204 37");
    expect(OFFICIAL_CONTACT.phone.e164).toBe("+917205720437");
    expect(OFFICIAL_CONTACT.website.url).toBe("https://www.nextwise.world");
  });

  it("builds working mailto: and tel: links from those values", () => {
    expect(OFFICIAL_CONTACT.founder.mailto).toBe("mailto:founder@nextwise.com");
    expect(OFFICIAL_CONTACT.coFounder.mailto).toBe("mailto:co-founder@nextwise.com");
    expect(OFFICIAL_CONTACT.phone.tel).toBe("tel:+917205720437");
    expect(CONTACT_PEOPLE.map((p) => p.email)).toEqual(["founder@nextwise.com", "co-founder@nextwise.com"]);
  });

  it("keeps the e-mail domain as nextwise.com (the website is nextwise.world; they must not be merged)", () => {
    for (const p of CONTACT_PEOPLE) expect(p.email.endsWith("@nextwise.com")).toBe(true);
    expect(JSON.stringify(OFFICIAL_CONTACT)).not.toMatch(/@nextwise\.world/);
  });

  it("is the only place the addresses and phone number are written (no hard-coded copies in src)", () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith(path.join("config", "contact.ts")))
      .filter((f) => /(founder|co-founder)@nextwise\.|7205\s?7204|917205720437/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the footer and contact page render from the config, with mailto:/tel: links", () => {
    for (const rel of ["components/navigation/Footer.tsx", "app/(site)/contact/page.tsx"]) {
      const code = read(rel);
      expect(code, rel).toMatch(/CONTACT\.(people|phone)/);
      expect(code, rel).toMatch(/\.mailto|\.tel/);
    }
  });

  it("makes no unapproved claims: no office address, opening hours, response-time promise or WhatsApp channel", () => {
    expect(CONTACT).not.toHaveProperty("supportHours");
    const shown = [read("components/navigation/Footer.tsx"), read("app/(site)/contact/page.tsx"), CONTACT.cityStatement]
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(shown).not.toMatch(/whatsapp|24\s*\/\s*7|within \d+ (hours|days)|office hours|Mon(day)?\s*[-–]\s*(Fri|Sat)/i);
  });

  it("the contact page no longer shows a form that pretends to send", () => {
    expect(existsSync(path.join(SRC, "components/sections/contact/ContactForm.tsx"))).toBe(false);
    const composer = read("components/sections/contact/ContactEmailComposer.tsx");
    expect(composer).toContain("mailto:");
    expect(composer).not.toMatch(/fetch\(|"use server"|Message sent|Thank you for/i);
  });
});

describe("CIUX-01 navigation (NAV_GROUPS)", () => {
  const groupHrefs = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));
  const headerHrefs = [...HEADER_LEADING_LINKS.map((l) => l.href), ...groupHrefs, ...HEADER_DIRECT_LINKS.map((l) => l.href), DISCOVERY_SESSION_CTA.href];

  it("has the three groups in order: Explore, Free tools, How it works", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["explore", "tools", "nextwise"]);
  });

  it("every header and footer link points at a page that exists", () => {
    const footerHrefs = Object.values(FOOTER_NAV).flat().map((l) => l.href);
    const missing = [...new Set([...headerHrefs, ...footerHrefs])].filter((h) => !routeExists(h));
    expect(missing).toEqual([]);
  });

  it("reaches every destination the brief requires", () => {
    for (const href of ["/careers", "/universities", "/courses", "/abroad", "/how-it-works", "/pricing", "/parents", "/about", "/contact", "/trust", "/book-counselling"]) {
      expect(headerHrefs, href).toContain(href);
    }
  });

  it("loses no link from the NW08.5 primary nav", () => {
    for (const item of MAIN_NAV_ITEMS) expect(headerHrefs, item.href).toContain(item.href);
  });

  it("never links to a resume builder, which does not exist yet (CIUX-06)", () => {
    const all = JSON.stringify({ NAV_GROUPS, FOOTER_NAV, HEADER_DIRECT_LINKS });
    expect(all).not.toMatch(/resume|r[ée]sum[ée]|\bcv\b/i);
    expect(routeExists("/resume")).toBe(false);
  });

  it("a link appears in only one header place, so only one item can show as active", () => {
    const counts = new Map<string, number>();
    for (const h of HEADER_NAV_HREFS) counts.set(h, (counts.get(h) ?? 0) + 1);
    expect([...counts].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("Home is the first header destination and points at the homepage (CIUX-01B)", () => {
    expect(HEADER_LEADING_LINKS).toEqual([{ label: "Home", href: "/" }]);
    expect(HEADER_NAV_HREFS[0]).toBe("/");
  });

  it("the free session call to action is the public booking page", () => {
    expect(DISCOVERY_SESSION_CTA.href).toBe("/book-counselling");
  });
});

describe("CIUX-01 button system", () => {
  const variants: ButtonVariant[] = ["primary", "secondary", "outline", "outline-inverse", "ghost", "text", "inverse", "destructive"];

  it("gives every variant its own look on the shared pill base", () => {
    const classes = variants.map((v) => buttonClasses(v));
    expect(new Set(classes).size).toBe(variants.length);
    for (const c of classes) {
      expect(c).toContain("rounded-[var(--radius-pill)]");
      expect(c).toContain("focus-visible:outline");
      expect(c).toContain("motion-reduce:");
    }
  });

  it("primary is the coral action colour with navy text; secondary is navy", () => {
    expect(buttonClasses("primary")).toMatch(/\bbg-action\b.*\btext-on-action\b/);
    expect(buttonClasses("secondary")).toContain("bg-primary");
  });

  it("every size meets the 40 px minimum target, and the default is 44 px", () => {
    expect(buttonClasses("primary", "sm")).toContain("min-h-[40px]");
    expect(buttonClasses("primary")).toContain("min-h-[44px]");
    expect(buttonClasses("primary", "lg")).toContain("min-h-[52px]");
  });
});

describe("CIUX-01 tokens", () => {
  const css = read("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("the action colour is the homepage's Electric Coral, with navy text on it", () => {
    expect(css).toMatch(/--brand-action:\s*#FF4D6D/i);
    expect(css).toMatch(/--brand-on-action:\s*#03045F/i);
  });

  it("no legacy purple remains as a live token value", () => {
    expect(css).not.toMatch(/#4c2e8c|#7c3aed|#6d28d9|#8b5cf6/i);
  });

  it("reduced motion is respected by the new menu and reveal motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*ciux-/);
  });
});
