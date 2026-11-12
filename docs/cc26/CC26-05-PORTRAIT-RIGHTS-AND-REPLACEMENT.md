# CC26-05: Homepage portrait — rights investigation and replacement plan

**Status:** investigated; replacement **prepared but not performed**. No image was downloaded, generated or replaced. The V5.4 portrait is a protected asset: replacing it needs a licensed image plus your design approval.

## 1. Findings

| Item | Finding |
|---|---|
| Asset | `public/home-v54/v54-portrait.png`: 1860 × 1174 RGBA, black and white, a young man in profile looking up. Derived strip: `public/home-v54/v54-portrait-base.png` (1860 × 1). |
| Where it appears | The V5.4 homepage hero (`NextwiseV54Hero.tsx`), which is live on www.nextwise.world according to the brief. It is not used anywhere else. |
| How it was made | `docs/home-v5-4/PORTRAIT-ASSET.md`: extracted from "the approved Nextwise V5 reference image". The subject was cut out of that reference; about 16% of the area (curls, ear, temple) was reconstructed with LaMa inpainting, then matted and upscaled with EDSR. |
| Origin of the person and photograph | The same document says the image "appears to depict the same person as the model in the Mindly reference used earlier in this project", that is, a **third-party** design reference. No licence, invoice, photographer credit or model release exists in the repository, the project notes or the CC-21 to CC-25 reports. |
| Rights position | **No documented right to the photograph (copyright) or to the person's likeness (model release).** Inpainting and upscaling do not create new rights: the result is a derivative of the original photograph. |
| Risk | The image is publicly live. Possible claims are copyright (photographer or agency) and personality or likeness rights (the model). The usual consequence is a takedown or licence-fee demand. Severity: **high** for a commercial launch. |
| Other photographic student images | `public/hero/nextwise-student-cutout.png`, `nextwise-student-hero.png`, `public/profile/profile-student-avatar.png`, `public/dashboard/student-next-action.png`. They look photorealistic (possibly AI-generated), and their provenance is **not recorded** either. They are lower priority because they are not the protected hero, but include them in the rights register (§4). |

## 2. Replacement options (commercially safe)

| Option | Rights you get | Fidelity to the approved composition | Typical lead time | Notes |
|---|---|---|---|---|
| **A. Commissioned shoot (recommended)** | Copyright assignment or an exclusive licence from the photographer, plus a signed model release (adult model) covering web, app, advertising and editing | Highest: same pose, angle and lighting can be directed (§3) | 1–2 weeks | You own the result; no other brand can use the same face |
| B. Licensed stock (a major agency, "model released" filter, commercial licence) | The agency's standard or extended licence; the agency holds the model release | Medium: you need a profile, upward-gaze, high-contrast portrait close to §3 | Days | Non-exclusive. Check the sensitive-use rules, and that education marketing and compositing are allowed |
| C. Illustration or silhouette in place of a photograph | Commissioned illustrator's assignment | Changes the look | 1–2 weeks | A design change. Needs a new design review, not just a swap |
| D. Remove the portrait layer temporarily | — | Visible change to the hero | Immediate | Only if legal advice requires removal before A or B is ready; needs your design approval |

Not acceptable: re-using or re-editing the current image; generating a face "in the style of" or resembling the current model; any unverified web image (the brief prohibits this).

## 3. Creative brief for option A or B (keeps the approved composition)

- **Pose:** head and shoulders, three-quarter **profile facing right**, chin lifted and **looking up and out** (aspirational), eyes softly closed or gazing upward; relaxed, natural expression.
- **Framing:** subject's head at the upper-centre of a 1860 × 1174 frame. Subject bounds about x 171–1320, y 88–1173. **The shirt meets the bottom edge.** Leave headroom for the floating cards (left and right of the head).
- **Hair:** volume at the top-left of the head (the cards overlap the hairline and ear).
- **Wardrobe:** plain dark crew-neck or T-shirt; no logos.
- **Light:** high-key studio, soft key from the front-left; final grade **black and white**, deep blacks, bright paper-white background, easy to cut out (plain light backdrop).
- **Deliverables:** RAW plus a full-resolution TIFF (at least 4000 px wide); the cut-out PNG with alpha at 1860 × 1174 is produced afterwards.
- **Model:** adult (18+), signed release naming Nextwise, the uses in §4, and editing and compositing.

## 4. Swap procedure (after rights and design approval)

1. Copy `docs/cc26/templates/PORTRAIT-RIGHTS-RECORD.template.md` to `docs/home-v5-4/PORTRAIT-RIGHTS-RECORD.md` and complete every field. Keep the signed documents in the contract store, not in git.
2. Produce the cut-out at 1860 × 1174 RGBA, black and white.
3. Validate: `node scripts/home/validate-v54-portrait.mjs <candidate.png> --write-base public/home-v54/v54-portrait-base.png`. It checks the rights record and the composition against `docs/home-v5-4/portrait-composition-reference.json`: size, greyscale, coverage within ±25%, subject bounds within 80 px, centre within 60 px, silhouette overlap of at least 80%, and the subject reaching the bottom edge. It writes the base strip only if every check passes.
4. Replace `public/home-v54/v54-portrait.png`. No code change is needed; `next/image` regenerates AVIF and WebP.
5. Update the two hashes in `src/components/sections/cc24-v54-baseline-hashes.json` **in the same commit**, with a note naming the approval.
6. Run the V5.4 homepage visual suite (suite V) and attach before/after screenshots at desktop, iPhone 13 and 320 px, and with reduced motion, for design approval.
7. Update `docs/home-v5-4/PORTRAIT-ASSET.md` (§Rights) to point at the rights record.

Today the validator, run on the current file, passes every composition check and **fails the rights check**. That is the intended state (`scripts/home/validate-v54-portrait.test.ts`, 7 tests).

## 5. Decision needed from you

- Choose option A (recommended) or B. If B, send the candidate's agency page or ID and I will check its licence terms against §4 before any download.
- Ask legal counsel whether the current portrait should stay live until the replacement is ready (option D).
- Approve the before/after screenshots once a licensed candidate exists.
