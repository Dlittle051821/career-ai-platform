/**
 * V5.6.2 public launch: the Privacy Policy, Terms of Use and Refund Policy.
 *
 * These are DRAFTS written for legal review. They describe only what the
 * website does in public-marketing mode (src/lib/launch/launch-mode.ts) and
 * what can be checked in this codebase. They state no company registration,
 * address, refund amount or timeline, processing practice or regulatory
 * compliance that has not been confirmed. Every point that needs the
 * business owner or a lawyer is listed in docs/release/V562-LEGAL-REVIEW.md.
 *
 * While `status` is "draft-for-legal-review", each page says so at the top,
 * and the release script refuses to stage a production deployment.
 * After review, set status to "approved" and fill in approvedBy, approvedOn
 * and effectiveDate in the same commit (a test enforces this).
 */
import { OFFICIAL_CONTACT } from "./contact";

export type LegalReviewStatus = "draft-for-legal-review" | "approved";

export const LEGAL_REVIEW: {
  status: LegalReviewStatus;
  /** Date this text was drafted. */
  draftedOn: string;
  /** Who approved the text (business owner and legal reviewer), once approved. */
  approvedBy: string | null;
  approvedOn: string | null;
  /** Date the policies take effect, once approved. */
  effectiveDate: string | null;
} = {
  status: "draft-for-legal-review",
  draftedOn: "14 November 2026",
  approvedBy: null,
  approvedOn: null,
  effectiveDate: null,
};

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type LegalDocument = { title: string; summary: string; sections: LegalSection[] };

const EMAILS = `${OFFICIAL_CONTACT.founder.email} or ${OFFICIAL_CONTACT.coFounder.email}`;
const PHONE = OFFICIAL_CONTACT.phone.display;

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  summary:
    "How Nextwise handles information when you visit www.nextwise.world or contact us. The website has no accounts, forms, payments or advertising trackers.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `Nextwise runs the website www.nextwise.world. For any question about your information, write to ${EMAILS}, or call ${PHONE}.`,
      ],
    },
    {
      heading: "What this policy covers",
      paragraphs: [
        "This policy covers the public website and the messages and calls you send us. Online accounts, online booking, applications and online payments are not open on the website. We will update this policy before any of them opens.",
      ],
    },
    {
      heading: "Information you send us",
      paragraphs: [
        "The website has no forms. When you email or call us, we receive what you choose to share. That is usually your name, your email address or phone number, and your message. A message may include information about a student's studies, interests or plans.",
        "The Contact and Book a free session pages only open your own email app or phone. Nothing you type there is sent to us or stored by the website.",
      ],
    },
    {
      heading: "Information collected when you browse",
      paragraphs: [
        "Our hosting provider processes technical information to deliver pages and keep the website secure. This includes your IP address, browser type, the page requested and the time of the request, recorded in server logs.",
        "The website counts how often career, course and pricing pages are viewed. When you follow a link from a course page to an official course-search portal, it records which link was used: the portal, subject, degree level, country and the page it was on. These records do not include your name, email address, account, IP address or any identifier for you or your device.",
      ],
    },
    {
      heading: "Cookies and browser storage",
      paragraphs: [
        "The website does not set cookies, and it does not use third-party analytics, advertising or social-media tracking.",
        "The homepage keeps one small setting in your browser's session storage, so the opening animation does not replay during the same visit. Your browser deletes it when you close the tab.",
      ],
    },
    {
      heading: "How we use information",
      paragraphs: ["We use the information you send us only to:"],
      bullets: [
        "reply to you;",
        "arrange a free Discovery Session or other conversation you ask for;",
        "send you information you ask for.",
      ],
    },
    {
      heading: "What we do not do",
      paragraphs: [
        "We do not sell personal information, and we do not use it for advertising. We do not share what you tell us with universities or other institutions unless you ask us to.",
      ],
    },
    {
      heading: "Service providers",
      paragraphs: [
        "The website is hosted by Vercel. The education information shown on the website is stored with Supabase. These providers may process information on servers outside India. We only use them to run the website.",
      ],
    },
    {
      heading: "Students under 18",
      paragraphs: [
        "Many of our visitors are students. If you are under 18, please involve a parent or guardian before you send us personal information. We ask only for what we need to answer your question.",
      ],
    },
    {
      heading: "How long we keep information",
      paragraphs: [
        "We keep messages and call notes only as long as we need them to respond to you and to follow up on what you asked for, unless the law requires us to keep them longer.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        `You can ask us to tell you what information we hold about you, to correct it or to delete it. You can also ask us to stop contacting you. Write to ${EMAILS}. Depending on the law that applies to you, you may have further rights, and we will help you use them.`,
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: ["When this policy changes, we will update this page and the date at the top."],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: "Terms of Use",
  summary: "The terms for using www.nextwise.world. They cover the public website only.",
  sections: [
    {
      heading: "About these terms",
      paragraphs: [
        "These terms apply when you use www.nextwise.world, which is run by Nextwise. By using the website, you agree to them. If you do not agree, please do not use the website.",
        "Any paid service will be covered by a separate written agreement, which you will see before you pay. Online accounts, booking, applications and payments are not open on the website.",
      ],
    },
    {
      heading: "Information on the website",
      paragraphs: [
        "The website gives general information about careers, courses, universities and studying in India and Europe. It is not personal advice. Fees, entry requirements, intakes, deadlines and visa rules change, and universities and governments set them. Always check them with the institution or official source before you decide or pay anything.",
        "We work to keep the information accurate, but we cannot promise that every detail is complete or up to date.",
      ],
    },
    {
      heading: "No guarantees",
      paragraphs: [
        "Nextwise does not guarantee admission, scholarships, visas, internships or jobs. Those decisions belong to universities, employers and governments.",
      ],
    },
    {
      heading: "Links to other websites",
      paragraphs: [
        "The website links to official university and government sites and to course-search portals. We do not control those sites and are not responsible for their content or how they handle your information.",
      ],
    },
    {
      heading: "Using the website",
      paragraphs: ["Please do not:"],
      bullets: [
        "try to get into parts of the website or its systems that are not public;",
        "disrupt or overload the website;",
        "copy large parts of the website, or use automated tools to collect its content;",
        "use the website for anything unlawful.",
      ],
    },
    {
      heading: "Our content",
      paragraphs: [
        "The Nextwise name, logo, design and written content belong to Nextwise or are used with permission. You may view and share pages for personal use. Please ask us before using our content for anything else.",
      ],
    },
    {
      heading: "Responsibility",
      paragraphs: [
        "The website is provided as it is. To the extent the law allows, Nextwise is not responsible for losses caused by relying on general information on the website without checking it with the official source. Nothing in these terms limits a responsibility that the law does not allow us to limit.",
      ],
    },
    {
      heading: "Applicable law",
      paragraphs: ["These terms are governed by the laws of India."],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        `When these terms change, we will update this page and the date at the top. Questions: ${EMAILS}, or ${PHONE}.`,
      ],
    },
  ],
};

export const REFUND_POLICY: LegalDocument = {
  title: "Refund Policy",
  summary: "How refunds work for Nextwise services. The website does not take payments.",
  sections: [
    {
      heading: "No payments through the website",
      paragraphs: [
        "You cannot pay for anything on www.nextwise.world. Online payment is not open, so there is nothing to refund for a website payment.",
        "The free Discovery Session is free. There is nothing to pay and nothing to refund.",
      ],
    },
    {
      heading: "Paid services",
      paragraphs: [
        "Before you pay for any service, you will receive a written agreement. It states the service, the fee and the refund and cancellation terms that apply to it. Those written terms decide any refund.",
      ],
    },
    {
      heading: "Asking for a refund",
      paragraphs: [
        `Write to ${EMAILS} with your name, the service and the reason. We will review the request against your written agreement and reply in writing.`,
      ],
    },
    {
      heading: "Your legal rights",
      paragraphs: ["This policy does not take away any right you have under consumer protection law."],
    },
    {
      heading: "Changes",
      paragraphs: [
        "We will update this policy before online payments open, and whenever our refund terms change.",
      ],
    },
  ],
};
