import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_REVIEW, PRIVACY_POLICY, REFUND_POLICY, TERMS_OF_USE, type LegalDocument } from "./legal";
import { OFFICIAL_CONTACT } from "./contact";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const text = (d: LegalDocument) =>
  [d.title, d.summary, ...d.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])])].join("\n");
const DOCS = { privacy: PRIVACY_POLICY, terms: TERMS_OF_USE, refund: REFUND_POLICY };

describe("V5.6.2 legal drafts: review status", () => {
  it("a draft carries no approval; an approval names who, when and the effective date", () => {
    if (LEGAL_REVIEW.status === "approved") {
      expect(LEGAL_REVIEW.approvedBy?.trim()).toBeTruthy();
      expect(LEGAL_REVIEW.approvedOn?.trim()).toBeTruthy();
      expect(LEGAL_REVIEW.effectiveDate?.trim()).toBeTruthy();
    } else {
      expect(LEGAL_REVIEW).toMatchObject({ approvedBy: null, approvedOn: null, effectiveDate: null });
    }
  });

  it("the legal pages render from these documents and show the draft notice while unapproved", () => {
    for (const [route, name] of [["privacy", "PRIVACY_POLICY"], ["terms", "TERMS_OF_USE"], ["refund-policy", "REFUND_POLICY"]]) {
      const page = read(`src/app/(site)/${route}/page.tsx`);
      expect(page).toContain(`<LegalDocumentPage doc={${name}} />`);
    }
    const component = read("src/components/sections/legal/LegalDocumentPage.tsx");
    expect(component).toContain('const draft = LEGAL_REVIEW.status !== "approved";');
    expect(component).toContain("not yet in effect");
  });
});

describe.each(Object.entries(DOCS))("V5.6.2 legal drafts: %s states no unconfirmed facts", (_name, doc) => {
  const t = text(doc);

  it("has no placeholder wording", () => {
    expect(t).not.toMatch(/placeholder|lorem|\bTBD\b|\bTBC\b|to be confirmed|\[|\]|coming soon|xx/i);
  });

  it("invents no company registration, address or tax details", () => {
    expect(t).not.toMatch(/\b(Pvt|Private Limited|Ltd|LLP|CIN|GSTIN|GST|PAN|registered office|registration number)\b/i);
    expect(t).not.toMatch(/\b(street|road|floor|building|pin ?code|Bhubaneswar|Cuttack)\b/i);
  });

  it("makes no regulatory-compliance claim", () => {
    expect(t).not.toMatch(/\b(compliant|complies|compliance|GDPR|DPDP|certified|ISO ?27001|SOC ?2)\b/i);
  });

  it("promises no refund amount, percentage or time limit", () => {
    expect(t).not.toMatch(/\d+\s*%|\d+\s*(business\s+|working\s+)?(days?|hours?|weeks?|months?)\b|full refund|money[- ]back/i);
  });

  it("uses only the official contact details", () => {
    const emails = (t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []);
    for (const e of emails) expect([OFFICIAL_CONTACT.founder.email, OFFICIAL_CONTACT.coFounder.email]).toContain(e);
    const phones = t.match(/\+\d[\d ]{8,}/g) ?? [];
    for (const p of phones) expect(p.trim()).toBe(OFFICIAL_CONTACT.phone.display);
  });
});

describe("V5.6.2 public pages: no misleading placeholders", () => {
  it.each([
    ["src/app/(site)/trust/page.tsx", /Sample agreement|Download sample|unavailable|ComingSoon|Coming later|placeholder|To be published|TrustBadge/],
    ["src/app/(site)/about/page.tsx", /TEAM_PLACEHOLDERS|TrustBadge|will be published once confirmed/],
    ["src/app/(site)/parents/page.tsx", /ComingSoon|Coming later|APPLICATION_STATUS_PREVIEW/],
    ["src/app/(site)/study-options/page.tsx", /Illustrative UI|sample layout|DemoNotice/],
    ["src/app/(site)/career-discovery/page.tsx", /WaitlistForm|This form is a demo|It isn&apos;t live yet/],
    ["src/data/trust.ts", /To be published after verification|Secure payment provider \(planned\)|service manager/],
    ["src/data/faqs.ts", /sample agreement|Refund Policy placeholder|Pending verification/],
  ])("%s", (file, banned) => {
    expect(read(file)).not.toMatch(banned);
  });
});
