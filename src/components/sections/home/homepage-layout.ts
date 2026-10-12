/**
 * UX10-H03 "Exact Homepage Reference Match" — shared layout constant for
 * the homepage's six sections only. The brief's own "page width/density"
 * requirement asks for a wider, more compact page ("approximately 92-94%
 * viewport width... max-width around 1500-1600px") than the sitewide
 * default `Container` max-width (1240px, used by 65+ other pages/sections
 * via `Section`). Rather than touch that shared default, every homepage
 * section passes this single constant to `Section`'s existing
 * (previously-unused) `containerClassName` prop, which `Container.tsx`
 * now treats as a full replacement for its default max-width rather than
 * an additive class (see Container.tsx's own docblock for why that's the
 * safe way to override a Tailwind arbitrary-value utility). One shared
 * constant, not six copy-pasted literals, so the homepage's width never
 * drifts between sections.
 *
 * UX10-H05B "EXACT TOP HOMEPAGE REFERENCE REPRODUCTION" — scoped to
 * Header/Hero/DiscoveryPillars/TrustedStudyExplorer only, explicitly
 * excluding How It Works, Why Nextwise, and the Final CTA from this
 * milestone's changes. Its own reference wants those top sections
 * noticeably wider still ("approximately 94-96% of viewport width... no
 * large empty side gaps," target `min(96vw, 1600px)`) than H03/H04's
 * 1560px. Rather than widen the ONE shared constant every homepage
 * section reads (which would silently change the three out-of-scope
 * sections' rendered width too, even though their own files are
 * untouched), this introduces a SECOND constant for the three in-scope
 * sections only. `HOMEPAGE_CONTAINER_CLASSNAME` (1560px) stays exactly as
 * H03 left it, still read by HowItWorks.tsx/WhyNextwise.tsx/
 * HomeFinalCTA.tsx, so those three sections' width is provably unchanged
 * this pass.
 */
export const HOMEPAGE_CONTAINER_CLASSNAME = "max-w-[1560px]";

export const HOMEPAGE_WIDE_CONTAINER_CLASSNAME = "max-w-[min(96vw,1600px)]";
