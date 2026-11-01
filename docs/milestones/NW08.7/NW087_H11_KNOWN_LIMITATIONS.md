# NW08.7 · H11 · Known limitations

Each item says whether it is verified or unverified.

| # | Limitation | Status and what to do |
|---|---|---|
| 1 | **The portrait is a generated image** (supplied in UX10-H02 and already used by the site). The brief prefers editorial photography of real people. | Verified from the repository's own records. Commission or license replacement photography before public launch (H04); no code change is needed. |
| 2 | **No real-device testing.** Every browser check ran in headless Chromium in a Linux container with no GPU. Not tested: iOS Safari, Android Chrome on a real phone, desktop Safari, Firefox. | **Unverified.** Open `/homepage-preview` from a phone on the same network (`npm run dev -- -H 0.0.0.0`) and check scrolling, photo loading and the sweep edge. |
| 3 | **Safari specifics:** masks with `pathLength`, `transform-box: fill-box` on SVG groups and the `svh` unit all have shipped Safari support, but none was observed here. | **Unverified** (see 2) |
| 4 | **Lighthouse figures are single runs** on a local production build with simulated throttling, using placeholder Supabase variables (the site's middleware needs them to start). Real-world field data will differ. | Measured (H08). Re-run on staging after deployment approval. |
| 5 | **Mobile LCP is dominated by the existing header logo** (`nextwise-logo-horizontal.png`, 2235×779 PNG). It is the LCP element on both the current and the new homepage. | Measured. It is outside this milestone (the logo files and `Logo.tsx` are deliberately untouched). A properly sized logo asset would help every page. |
| 6 | **Software-compositor frame timing:** the headless browser composites on the CPU. Frame figures in H08 are a relative baseline, not a device prediction. | Measured, with that caveat |
| 7 | **No-JavaScript visitors** get the headline, promise and actions at once (server HTML), and the resting line. The ribbon stays at its opening state and the story section is still 250–320svh tall. Everything below is reachable by scrolling. | By design; verified via the server HTML (H10) |
| 8 | **Reduced-motion users** who load the page without the OS setting and then turn it on mid-visit switch to the static view straight away (the hook is live). Visitors with the setting already on may briefly see the animated layout before hydration switches them to the static view. | Verified: the static view renders. The brief flash is a known trade-off of avoiding a server-side guess. |
| 9 | **Lighthouse accessibility findings on the page are all pre-existing**, in sections below the hero and in the header (colour contrast of `text-on-primary-muted` in the final CTA, label/name mismatch on the destination cards, the header's `/login` link name). None is in the hero. | Measured (H08). Out of scope for this milestone. |
| 10 | **The registration-prompt hold covers the timed path only.** A contextual request (a visitor explicitly saving something) can still open the prompt during the story, which is intended. | Verified by test |
| 11 | **Known business issues stay tracked independently:** the ₹1,999 GST-inclusive checkout concern and the NW07 database verification items are unaffected by, and not addressed by, this milestone. | n/a |
