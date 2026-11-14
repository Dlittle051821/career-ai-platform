# V5.6.2 public launch: legal and content review items

The Privacy Policy, Terms of Use and Refund Policy are **drafts for legal review**
(`src/config/legal.ts`, status `draft-for-legal-review`). Each page says so at the top. The production
staging script refuses to stage while the status is a draft.

They describe only what the website does in public-marketing mode and what can be checked in the code.
Nothing below has been invented. Each item needs an answer from the business owner, a lawyer, or both.

## To approve

1. Have a lawyer review the three texts in `src/config/legal.ts`.
2. Make any changes in that file.
3. Set `status: "approved"`, and fill in `approvedBy`, `approvedOn` and `effectiveDate`. A test refuses an
   approval without all three.
4. Commit on top of `release/v562-public-launch`, then use that commit for staging.

## Owner decisions (facts only the business can supply)

| # | Item | Where it matters | Draft today |
|---|---|---|---|
| O1 | Legal entity name and form (sole proprietor, LLP, Pvt Ltd…) | Privacy "Who we are"; Terms "About these terms" | "Nextwise", no entity stated |
| O2 | Registered or postal address | Privacy, Terms, Trust Center | Not stated |
| O3 | Registration, GST and any licence numbers | Trust Center | Removed (the "to be published" rows are gone) |
| O4 | Grievance or privacy contact: named person or role | Privacy "Your choices"; Trust Center | Founder and co-founder mailboxes |
| O5 | How long emails and call notes are kept | Privacy "How long we keep information" | "Only as long as we need them…": no period stated |
| O6 | Which email provider hosts founder@ and co-founder@nextwise.com | Privacy "Service providers" | Not named. Mailbox delivery is still unverified (CIUX-01) |
| O7 | Whether anyone besides the founders reads the mailboxes or takes calls | Privacy "How we use information" | Not stated |
| O8 | Written-agreement commitment: is every paid service covered by a written agreement before payment? | Terms, Refund Policy, Trust Center, Parents | Stated as a commitment (it was already on the approved Trust and Parents pages) |
| O9 | Itemised invoice and receipt for every payment | Trust Center | Kept from the approved page |
| O10 | Refund windows, cancellation fees, partial refunds | Refund Policy | Deliberately not stated: "the written agreement decides" |
| O11 | Spoken Odia during counselling on request | How It Works FAQ | Kept from the approved FAQ, without "coming soon" |
| O12 | Founder names, photographs and credentials | About, Trust Center | Not published. Roles and mailboxes only |
| O13 | Commission and referral disclosure policy | Trust Center | Unchanged: "intended policy, not yet finalised" |

## Legal questions (for the lawyer)

| # | Question | Draft today |
|---|---|---|
| L1 | Digital Personal Data Protection Act 2023 and its Rules: notice contents, consent for children's data, grievance officer, Data Protection Board reference | No compliance claim is made. Rights are described in general terms |
| L2 | Data processed outside India by Vercel and Supabase: wording and any transfer conditions | "May process information on servers outside India" |
| L3 | Children under 18: is "please involve a parent or guardian" enough, or is verifiable parental consent needed before a student emails? | Asks for a parent or guardian |
| L4 | Governing law and courts: city or state for jurisdiction | "Governed by the laws of India", with no court named |
| L5 | Limitation of liability wording under Indian consumer law | Plain-language limitation, with no liability cap |
| L6 | Consumer Protection (E-Commerce) Rules 2020: what applies once online payment opens | The Refund Policy says no website payments exist yet |
| L7 | Server logs at the host: what Vercel keeps and for how long | "Recorded in server logs": no period stated |
| L8 | Effective-date mechanics and notice of changes | "We will update this page and the date" |

## Facts the drafts rely on (verified in this build)

- In public-marketing mode the website has no accounts, forms, payments or online booking. It refuses
  every POST (Server Actions included) with 405.
- No cookies are set. The browser makes no Supabase call. The browser checks found 0 cookies and
  0 Supabase requests on 22 pages, at five widths.
- The homepage keeps one session-storage value for its intro animation (`V54Motion.tsx`).
- Course-search clicks and career, course and pricing page views are counted anonymously. `user_id` is
  `auth.uid()`, which is null without an account. No session or anonymous id is sent, and no IP is
  stored (`0009_trusted_course_search.sql`, `src/lib/analytics/track.ts`, `src/lib/supabase/pricing/analytics.ts`).
- No third-party analytics, advertising or social scripts are used. Fonts are self-hosted by
  `next/font` at build time.
- Contact and booking links open the visitor's own email app or phone. Nothing is sent from the page.

## Content removed from public pages (misleading or unsupported)

- **Trust Center:**
  - the "Verify the company" rows (all "to be published after verification");
  - the unfilled team roles;
  - "Sample agreement" with the disabled "Download sample (unavailable)" button;
  - the stamp-paper note;
  - "Secure payment provider (planned)";
  - the "Coming later" application tracker;
  - the counsellor → service manager → grievance officer chain (those roles don't exist);
  - "Refund Policy placeholder" wording.
- **About:**
  - the placeholder team cards. Replaced by the founder and co-founder mailboxes and the phone number.
  - The "what's live today" paragraph, which said accounts, applications and payments were live. In
    public-marketing mode it now says they are not open.
- **Parents:** the "Coming later" parent dashboard preview.
- **Study options:** the "Illustrative UI" sample comparison.
- **Career discovery:**
  - the demo waitlist form, which sent nothing. Replaced by an email link.
  - "the career library isn't live yet", which was wrong: it is at `/careers`.
- **FAQs:** "Pending verification", "sample agreement", "Refund Policy placeholder", and "Odia
  experience coming soon".
