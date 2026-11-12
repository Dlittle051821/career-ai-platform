/**
 * CIUX-01 — the ONE place for Nextwise's official public contact details.
 *
 * Every public component (footer, contact page, header menus, structured
 * data) reads these values; none hard-codes an address or number. To change
 * a detail, edit this file only.
 *
 * Source: the CIUX-01 brief (2026-11-12), verbatim.
 *  - The founder and co-founder addresses use the nextwise.com domain while
 *    the public website is nextwise.world. This is intentional: do not
 *    "correct" either domain.
 *  - These are contact addresses for people. They are NOT the sender for
 *    transactional mail (auth, invoices): that configuration lives with the
 *    email provider and Supabase Auth and is deliberately untouched.
 *  - Mailbox delivery has not been verified from code; see
 *    docs/ciux/CIUX-01-CONTACT-AUDIT.md.
 *  - No WhatsApp channel, office address, opening hours or response-time
 *    promise is published: none has been approved.
 */

export type ContactPerson = {
  /** Role shown next to the address, e.g. "Founder". */
  role: string;
  email: string;
  /** Ready-to-use mailto: link. */
  mailto: string;
};

const mailto = (address: string) => `mailto:${address}`;

export const OFFICIAL_CONTACT = {
  founder: { role: "Founder", email: "founder@nextwise.com", mailto: mailto("founder@nextwise.com") },
  coFounder: { role: "Co-Founder", email: "co-founder@nextwise.com", mailto: mailto("co-founder@nextwise.com") },
  phone: {
    /** As written in the approved brief; shown to people. */
    display: "+91 7205 7204 37",
    /** E.164, for tel: links and structured data. */
    e164: "+917205720437",
    /** Opens the dialler on phones. */
    tel: "tel:+917205720437",
  },
  website: {
    url: "https://www.nextwise.world",
    display: "www.nextwise.world",
  },
} as const;

/** Founder first, then co-founder: the order every surface uses. */
export const CONTACT_PEOPLE: readonly ContactPerson[] = [OFFICIAL_CONTACT.founder, OFFICIAL_CONTACT.coFounder];
