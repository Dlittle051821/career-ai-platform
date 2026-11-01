# NW08.7 · 10 · Recommended concept

## Recommendation: A, The Living Path, finished with B's ending

**Take The Living Path forward as the homepage signature.** Borrow one idea from The Unfolding Future: the story's final state should itself be the working entry points, not a picture followed by links.

### Why The Living Path

1. **It *is* the brand.** The ribbon resolves into an N-arrow trajectory and hands over to the official mark. No other concept ties the motion to the Nextwise identity so directly, and it does so without redrawing the logo.
2. **It tells the product split honestly.** One path branches into exactly the two products, Career Intelligence (India) and Study Abroad (six countries), which is the decision a visitor actually faces.
3. **It is the lightest.** It is one inline SVG with no images, so it has no LCP image and nothing extra to download beyond the shared Motion runtime. This matters on the Indian mobile networks most visitors will use.
4. **It holds up on phones.** The same drawing re-frames to a narrow screen without a separate choreography. Concept B needed a vertical variant and Concept C a re-cropped photograph.
5. **It is the lowest-risk to productionise.** It needs no CSS 3D (B's main device risk) and no photography programme (C's main dependency).

### What to borrow from the others

- **From B:** end on usable navigation. On the homepage, the resolved path's two branch labels should be the primary CTAs, with the remaining entry points directly beneath.
- **From C:** the calm, quiet final beat. Dim the scene behind the call to action so the last screen reads as a decision, not as an animation.

### Why not the others (yet)

- **B, The Unfolding Future,** is the most literal product reveal and the most "useful" ending, but folded paper is a less distinctive brand image. Its CSS 3D also needs device testing on lower-end Android phones before it could ship.
- **C, The Window to Tomorrow,** is the most emotional, but it rests on one photograph. A homepage built on it would need a commissioned or licensed photography set that represents real destinations. It would also be the heaviest of the three.

### Before any homepage adoption (not done in this milestone)

1. Review the prototypes on real devices (a mid-range Android phone and an iPhone) via `npm run dev` on the local network.
2. Run Lighthouse against a production build of the chosen concept on a staging route. The Motion Lab itself is blocked in production by design, so production scores were not measured here.
3. Decide the scroll length (currently 520svh). For a homepage, 300–380svh is likely to feel less long; this needs user review.
4. Get written approval to change the production homepage.
