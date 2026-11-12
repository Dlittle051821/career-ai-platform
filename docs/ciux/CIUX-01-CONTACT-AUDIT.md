# CIUX-01: Contact audit (deliverable E)

## Official details (one source)

`src/config/contact.ts` is the only file that contains them. A test fails if any other source file contains either address or the phone number.

| Field | Value |
|---|---|
| Founder | `founder@nextwise.com` |
| Co-Founder | `co-founder@nextwise.com` |
| Phone (display) | `+91 7205 7204 37` |
| Phone (canonical, `tel:`) | `+917205720437` |
| Website | `https://www.nextwise.world` |

The e-mail domain is `nextwise.com` and the website is `nextwise.world`. They are deliberately different and must not be merged; a test guards this.

## What was changed

| File | Before | After |
|---|---|---|
| `src/config/site.ts` (`CONTACT`) | "Email support — coming soon"; `supportHours: "Mon–Sat, 10:00–18:00 IST (illustrative — to be confirmed)"` | Founder and co-founder e-mails, phone, website, a city statement. Hours removed (not approved) |
| `src/app/(site)/contact/page.tsx` | "Get in touch", support hours card, demo form | Founder, co-founder and phone link cards (`mailto:`/`tel:`), purposes, free-session CTA, e-mail composer |
| `src/components/sections/contact/ContactForm.tsx` | Demo form: validated input, sent nothing, then showed success | **Deleted** |
| `src/components/sections/contact/ContactEmailComposer.tsx` | (new) | Chooses recipient and topic, opens the visitor's own mail app via `mailto:`. States plainly that nothing is sent from the page |
| `src/components/navigation/Footer.tsx` | No contact links | "Contact Nextwise": both e-mails and the phone as links; website link |
| `src/app/(site)/trust/page.tsx` | `DemoNotice` placeholder for escalation contact | Founder `mailto:` and phone `tel:` sentence |
| `src/data/trust.ts` | Escalation step text referred to an unpublished channel | Refers to the founder e-mail and phone |
| `src/data/faqs.ts` | Claimed an Odia language switcher; grievance contact "coming soon" | Odia "coming soon"; grievance via founder e-mail or phone |
| `src/components/sections/legal/LegalPlaceholder.tsx` | No contact | "Email founder@…" link from config |
| `src/lib/seo/structured-data.ts` | No contact point | Organization `contactPoint`: telephone, founder e-mail, India, English |

Results (1440 px audit, `after-final`): every public route has 2 `mailto:` and 1 `tel:` link (footer); `/contact` has 5 and 2; `/trust` and the legal pages have 3. Before: none anywhere.

## Not shown, on purpose

- No office address (none approved). The city statement says Odisha and India, remote-first.
- No opening hours, no response-time promise, no 24/7 claim.
- No WhatsApp channel for Nextwise.

## Left unchanged, with reasons

| Reference | Why it stays |
|---|---|
| "WhatsApp" in `BookingForm.tsx`, `DiscoverySessionBookingForm.tsx`, `discovery-session.ts`, `booking-input.ts` | The student's preferred contact method in a booking form, not a Nextwise channel |
| "WhatsApp" in admin `LeadForm.tsx`, `admin/leads/page.tsx`, pricing types and admin pricing form | Internal admin hints and plan copy fields; authenticated, out of scope |
| `example.com` in `lib/ai/config.ts` and test fixtures | Fictional-domain safety lists and fixtures (brief: do not alter fixtures for this) |
| `fake@example.com` in `lib/career-intelligence/evaluation/profiles.ts` | Evaluation data, never shown publicly |
| Team placeholders and legal placeholders | Not contact details; legal text needs counsel, not CIUX |
| University and third-party contacts in data files | Legitimate external contacts (brief: do not replace) |
| Transactional e-mail sender, auth e-mail settings, SMTP or provider secrets | Not touched. `founder@nextwise.com` is **not** assumed to be the transactional sender |

## Open items (need the owner)

1. **Mailbox delivery is unverified.** The links open a mail app or dialler; nothing here proves the two mailboxes receive mail or that the phone is answered. Please send a test e-mail to each address and confirm.
2. **No contact form submits to Nextwise.** The demo form was removed rather than wired to a new provider (the brief forbids a new provider or DNS change). If a real form is wanted, it needs an approved provider and sender, which is backlog CIUX-07.
3. Confirm whether a postal address, hours, or WhatsApp should ever be published; none are shown until then.
