# NW-V4 homepage — image asset manifest

Every photograph except the hero was produced from the **original full-resolution file** downloaded from Pexels (`https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg`, no resize parameters) — no screenshots, video frames or mockup exports. Licence: Pexels licence (free commercial use; attribution not required, crediting photographers is recommended). The pipeline scripts ship in the installation package under `tools/asset-pipeline/`.

| Asset | Source | Source resolution | Usage | Delivered widths | Formats | Total size |
|---|---|---|---|---|---|---|
| `hero-v5-desktop` | The approved homepage mockup (1672 × 941): its own photography of the student, sunrise, mountains and university, extracted with all UI, text and the N removed; Pexels 412462 cloud texture inside the valley fog | 1672x941 (mockup) | Hero (L0), desktop: full stage incl. 3% inset, 1526.4 × 954 stage px | 763, 1145, 1526, 2290, 3053 | AVIF, WebP, JPEG fallback | 0.38 MB |
| `hero-v5-mobile` | Same scene, mobile composition | 1672x941 (mockup) | Hero (L0), mobile: full stage incl. 3% inset, 413.4 × 894.6 stage px | 413, 620, 826, 1240, 1447 | AVIF, WebP, JPEG fallback | 0.35 MB |
| `hero-v5-bleed-desktop` | Same scene, continued beyond the stage | 1672x941 (mockup) | Behind the stage on non-16:10 viewports (region x −560…2000, y −540…1440) | 1280, 1920, 2560 | AVIF, WebP, JPEG fallback | 0.21 MB |
| `hero-v5-bleed-mobile` | Same scene, continued beyond the stage | 1672x941 (mockup) | Behind the stage on mobile (region x −160…550, y −300…1150) | 710, 1065, 1420 | AVIF, WebP, JPEG fallback | 0.18 MB |
| `pathway-career` | Pexels 4348078 (Antoni Shkraba) | 2754x4000 | Two Pathways — Career Intelligence card | 640, 1024, 1600, 2400, 2754 | AVIF, WebP, JPEG fallback | 3.01 MB |
| `pathway-abroad` | Pexels 23180833 (V Marin) | 2714x4071 | Two Pathways — Study Abroad card | 640, 1024, 1600, 2400, 2714 | AVIF, WebP, JPEG fallback | 3.39 MB |
| `dest-de` | Pexels 16760724 | 3313x2970 | Destination explorer — Germany (Heidelberg) | 640, 1024, 1600, 2400, 3313 | AVIF, WebP, JPEG fallback | 2.14 MB |
| `dest-ie` | Pexels 15874209 (Sofía Marquet) | 2848x4272 | Destination explorer — Ireland (Trinity College) | 640, 1024, 1600, 2400, 2848 | AVIF, WebP, JPEG fallback | 1.46 MB |
| `dest-nl` | Pexels 21293913 | 3734x2535 | Destination explorer — Netherlands (Delft) | 640, 1024, 1600, 2400, 3200, 3734 | AVIF, WebP, JPEG fallback | 5.73 MB |
| `dest-fr` | Pexels 16626961 (Mehmet Turgut Kirkgoz) | 2736x3648 | Destination explorer — France (Sorbonne) | 640, 1024, 1600, 2400, 2736 | AVIF, WebP, JPEG fallback | 3.45 MB |
| `dest-se` | Pexels 29116362 (Lost Wonderer) | 3000x4000 | Destination explorer — Sweden (Uppsala) | 640, 1024, 1600, 2400, 3000 | AVIF, WebP, JPEG fallback | 7.22 MB |
| `dest-dk` | Pexels 416024 (Pixabay) | 6016x4000 | Destination explorer — Denmark (Nyhavn) | 640, 1024, 1600, 2400, 3200, 4000 | AVIF, WebP, JPEG fallback | 4.35 MB |
| `final-bg` | Pexels 4332199 | 5760x3840 | Final scene background (14–16% opacity) | 960, 1600, 2400 | AVIF, WebP, JPEG fallback | 0.46 MB |

Total on disk: 33.8 MB across 135 files (+ `dither-256.png`, 41 KB). A visitor downloads **one** file per photo — the one `srcset`/`sizes` selects for their screen (e.g. a 1440 × 900 @1x window fetches the 848 px hero, ~40 KB AVIF; 1440 × 900 @2x fetches the 1696 px hero, ~125 KB).

## Hero scene (from the approved mockup)

The hero is the approved mockup's own photography. The previous V4 hero (Pexels 6324235 composite) and the rejected woman-and-castle composite are not used anywhere.

| Step | What was done |
|---|---|
| Extraction | The student was matted (ISNet) and the headline, buttons, glass cards, ribbon N and trust bar were masked out of the mockup. |
| Rebuild | Hidden areas were inpainted at two scales; the face edge next to the former ribbon was re-composited from the student's own pixels. |
| Extension | Sky extended upward to a clear zenith; sides continued from the mockup's own left/right edges; below mockup row 484 (where the glass trust bar began) the scene becomes rising valley fog with an irregular top. |
| Upsampling | ×2 Lanczos with gentle detail recovery; grain and dither on quantisation. |
| Placement | Desktop: scale 0.75 stage px per mockup px at (241, 316), so the student sits right of the headline column with his face level with "Next."; mobile: scale 0.60 at (−262, 92). A soft haze veil sits behind the copy column. |

**Limitation:** the mockup is 1672 px wide, so on a 2× display the student is shown at about 1.5× his mockup pixels and is slightly soft on large Retina screens. A higher-resolution original of the same photograph would remove this.

## Other files

| File | Source | Usage |
|---|---|---|
| `/brand/nextwise-icon.png` (existing, unchanged) | Official NextWise master icon, 1336 × 1336 | The N in every scene (drawn up to ~1310 device px; the 512 px icon would have been upscaled) |
| `/home-v4/dither-256.png` | Generated noise (±1–2/255) | Anti-banding veil over the stage |

## Per-file list

### hero-v5-desktop
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/hero-v5-desktop-763.avif` | 763 × 477 | avif | 9,159 |
| `public/home-v4/hero-v5-desktop-763.webp` | 763 × 477 | webp | 10,402 |
| `public/home-v4/hero-v5-desktop-1145.avif` | 1145 × 716 | avif | 15,419 |
| `public/home-v4/hero-v5-desktop-1145.webp` | 1145 × 716 | webp | 18,594 |
| `public/home-v4/hero-v5-desktop-1526.avif` | 1526 × 954 | avif | 22,689 |
| `public/home-v4/hero-v5-desktop-1526.webp` | 1526 × 954 | webp | 27,654 |
| `public/home-v4/hero-v5-desktop-2290.avif` | 2290 × 1431 | avif | 39,529 |
| `public/home-v4/hero-v5-desktop-2290.webp` | 2290 × 1431 | webp | 48,130 |
| `public/home-v4/hero-v5-desktop-3053.avif` | 3053 × 1908 | avif | 60,625 |
| `public/home-v4/hero-v5-desktop-3053.webp` | 3053 × 1908 | webp | 71,054 |
| `public/home-v4/hero-v5-desktop-1526.jpg` | 1526 × 954 | jpg | 59,420 |

### hero-v5-mobile
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/hero-v5-mobile-413.avif` | 413 × 894 | avif | 8,641 |
| `public/home-v4/hero-v5-mobile-413.webp` | 413 × 894 | webp | 9,758 |
| `public/home-v4/hero-v5-mobile-620.avif` | 620 × 1342 | avif | 15,492 |
| `public/home-v4/hero-v5-mobile-620.webp` | 620 × 1342 | webp | 17,756 |
| `public/home-v4/hero-v5-mobile-826.avif` | 826 × 1787 | avif | 22,257 |
| `public/home-v4/hero-v5-mobile-826.webp` | 826 × 1787 | webp | 26,694 |
| `public/home-v4/hero-v5-mobile-1240.avif` | 1240 × 2683 | avif | 38,693 |
| `public/home-v4/hero-v5-mobile-1240.webp` | 1240 × 2683 | webp | 45,960 |
| `public/home-v4/hero-v5-mobile-1447.avif` | 1447 × 3131 | avif | 48,756 |
| `public/home-v4/hero-v5-mobile-1447.webp` | 1447 × 3131 | webp | 57,464 |
| `public/home-v4/hero-v5-mobile-826.jpg` | 826 × 1787 | jpg | 57,279 |

### hero-v5-bleed-desktop
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/hero-v5-bleed-desktop-1280.avif` | 1280 × 990 | avif | 12,848 |
| `public/home-v4/hero-v5-bleed-desktop-1280.webp` | 1280 × 990 | webp | 16,134 |
| `public/home-v4/hero-v5-bleed-desktop-1920.avif` | 1920 × 1485 | avif | 23,068 |
| `public/home-v4/hero-v5-bleed-desktop-1920.webp` | 1920 × 1485 | webp | 29,536 |
| `public/home-v4/hero-v5-bleed-desktop-2560.avif` | 2560 × 1980 | avif | 39,407 |
| `public/home-v4/hero-v5-bleed-desktop-2560.webp` | 2560 × 1980 | webp | 45,582 |
| `public/home-v4/hero-v5-bleed-desktop-1280.jpg` | 1280 × 990 | jpg | 40,772 |

### hero-v5-bleed-mobile
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/hero-v5-bleed-mobile-710.avif` | 710 × 1450 | avif | 12,127 |
| `public/home-v4/hero-v5-bleed-mobile-710.webp` | 710 × 1450 | webp | 14,754 |
| `public/home-v4/hero-v5-bleed-mobile-1065.avif` | 1065 × 2175 | avif | 21,757 |
| `public/home-v4/hero-v5-bleed-mobile-1065.webp` | 1065 × 2175 | webp | 26,702 |
| `public/home-v4/hero-v5-bleed-mobile-1420.avif` | 1420 × 2900 | avif | 34,627 |
| `public/home-v4/hero-v5-bleed-mobile-1420.webp` | 1420 × 2900 | webp | 39,946 |
| `public/home-v4/hero-v5-bleed-mobile-710.jpg` | 710 × 1450 | jpg | 33,891 |

### pathway-career
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/pathway-career-640.avif` | 640 × 930 | avif | 52,821 |
| `public/home-v4/pathway-career-640.webp` | 640 × 930 | webp | 71,378 |
| `public/home-v4/pathway-career-1024.avif` | 1024 × 1487 | avif | 107,363 |
| `public/home-v4/pathway-career-1024.webp` | 1024 × 1487 | webp | 137,902 |
| `public/home-v4/pathway-career-1600.avif` | 1600 × 2324 | avif | 210,529 |
| `public/home-v4/pathway-career-1600.webp` | 1600 × 2324 | webp | 255,286 |
| `public/home-v4/pathway-career-2400.avif` | 2400 × 3486 | avif | 397,906 |
| `public/home-v4/pathway-career-2400.webp` | 2400 × 3486 | webp | 457,228 |
| `public/home-v4/pathway-career-2754.avif` | 2754 × 4000 | avif | 545,053 |
| `public/home-v4/pathway-career-2754.webp` | 2754 × 4000 | webp | 581,782 |
| `public/home-v4/pathway-career-1024.jpg` | 1024 × 1487 | jpg | 338,716 |

### pathway-abroad
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/pathway-abroad-640.avif` | 640 × 960 | avif | 42,469 |
| `public/home-v4/pathway-abroad-640.webp` | 640 × 960 | webp | 57,992 |
| `public/home-v4/pathway-abroad-1024.avif` | 1024 × 1536 | avif | 102,799 |
| `public/home-v4/pathway-abroad-1024.webp` | 1024 × 1536 | webp | 130,532 |
| `public/home-v4/pathway-abroad-1600.avif` | 1600 × 2400 | avif | 244,942 |
| `public/home-v4/pathway-abroad-1600.webp` | 1600 × 2400 | webp | 287,210 |
| `public/home-v4/pathway-abroad-2400.avif` | 2400 × 3600 | avif | 473,312 |
| `public/home-v4/pathway-abroad-2400.webp` | 2400 × 3600 | webp | 541,260 |
| `public/home-v4/pathway-abroad-2714.avif` | 2714 × 4071 | avif | 635,838 |
| `public/home-v4/pathway-abroad-2714.webp` | 2714 × 4071 | webp | 692,922 |
| `public/home-v4/pathway-abroad-1024.jpg` | 1024 × 1536 | jpg | 348,463 |

### dest-de
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-de-640.avif` | 640 × 574 | avif | 30,808 |
| `public/home-v4/dest-de-640.webp` | 640 × 574 | webp | 38,664 |
| `public/home-v4/dest-de-1024.avif` | 1024 × 918 | avif | 64,584 |
| `public/home-v4/dest-de-1024.webp` | 1024 × 918 | webp | 78,430 |
| `public/home-v4/dest-de-1600.avif` | 1600 × 1434 | avif | 131,491 |
| `public/home-v4/dest-de-1600.webp` | 1600 × 1434 | webp | 153,228 |
| `public/home-v4/dest-de-2400.avif` | 2400 × 2152 | avif | 260,519 |
| `public/home-v4/dest-de-2400.webp` | 2400 × 2152 | webp | 285,484 |
| `public/home-v4/dest-de-3313.avif` | 3313 × 2970 | avif | 504,047 |
| `public/home-v4/dest-de-3313.webp` | 3313 × 2970 | webp | 500,386 |
| `public/home-v4/dest-de-1024.jpg` | 1024 × 918 | jpg | 193,724 |

### dest-ie
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-ie-640.avif` | 640 × 960 | avif | 23,008 |
| `public/home-v4/dest-ie-640.webp` | 640 × 960 | webp | 27,570 |
| `public/home-v4/dest-ie-1024.avif` | 1024 × 1536 | avif | 49,673 |
| `public/home-v4/dest-ie-1024.webp` | 1024 × 1536 | webp | 61,188 |
| `public/home-v4/dest-ie-1600.avif` | 1600 × 2400 | avif | 103,367 |
| `public/home-v4/dest-ie-1600.webp` | 1600 × 2400 | webp | 126,400 |
| `public/home-v4/dest-ie-2400.avif` | 2400 × 3600 | avif | 188,735 |
| `public/home-v4/dest-ie-2400.webp` | 2400 × 3600 | webp | 224,378 |
| `public/home-v4/dest-ie-2848.avif` | 2848 × 4272 | avif | 255,951 |
| `public/home-v4/dest-ie-2848.webp` | 2848 × 4272 | webp | 299,890 |
| `public/home-v4/dest-ie-1024.jpg` | 1024 × 1536 | jpg | 171,005 |

### dest-nl
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-nl-640.avif` | 640 × 434 | avif | 44,126 |
| `public/home-v4/dest-nl-640.webp` | 640 × 434 | webp | 67,688 |
| `public/home-v4/dest-nl-1024.avif` | 1024 × 695 | avif | 104,612 |
| `public/home-v4/dest-nl-1024.webp` | 1024 × 695 | webp | 160,078 |
| `public/home-v4/dest-nl-1600.avif` | 1600 × 1086 | avif | 229,567 |
| `public/home-v4/dest-nl-1600.webp` | 1600 × 1086 | webp | 355,780 |
| `public/home-v4/dest-nl-2400.avif` | 2400 × 1629 | avif | 432,175 |
| `public/home-v4/dest-nl-2400.webp` | 2400 × 1629 | webp | 658,266 |
| `public/home-v4/dest-nl-3200.avif` | 3200 × 2172 | avif | 647,656 |
| `public/home-v4/dest-nl-3200.webp` | 3200 × 2172 | webp | 965,312 |
| `public/home-v4/dest-nl-3734.avif` | 3734 × 2535 | avif | 884,465 |
| `public/home-v4/dest-nl-3734.webp` | 3734 × 2535 | webp | 1,179,734 |
| `public/home-v4/dest-nl-1024.jpg` | 1024 × 695 | jpg | 274,003 |

### dest-fr
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-fr-640.avif` | 640 × 853 | avif | 51,477 |
| `public/home-v4/dest-fr-640.webp` | 640 × 853 | webp | 70,820 |
| `public/home-v4/dest-fr-1024.avif` | 1024 × 1365 | avif | 117,067 |
| `public/home-v4/dest-fr-1024.webp` | 1024 × 1365 | webp | 161,634 |
| `public/home-v4/dest-fr-1600.avif` | 1600 × 2133 | avif | 242,289 |
| `public/home-v4/dest-fr-1600.webp` | 1600 × 2133 | webp | 335,200 |
| `public/home-v4/dest-fr-2400.avif` | 2400 × 3200 | avif | 445,957 |
| `public/home-v4/dest-fr-2400.webp` | 2400 × 3200 | webp | 592,810 |
| `public/home-v4/dest-fr-2736.avif` | 2736 × 3648 | avif | 578,224 |
| `public/home-v4/dest-fr-2736.webp` | 2736 × 3648 | webp | 719,066 |
| `public/home-v4/dest-fr-1024.jpg` | 1024 × 1365 | jpg | 302,702 |

### dest-se
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-se-640.avif` | 640 × 853 | avif | 69,546 |
| `public/home-v4/dest-se-640.webp` | 640 × 853 | webp | 100,150 |
| `public/home-v4/dest-se-1024.avif` | 1024 × 1365 | avif | 179,828 |
| `public/home-v4/dest-se-1024.webp` | 1024 × 1365 | webp | 256,984 |
| `public/home-v4/dest-se-1600.avif` | 1600 × 2133 | avif | 429,425 |
| `public/home-v4/dest-se-1600.webp` | 1600 × 2133 | webp | 619,750 |
| `public/home-v4/dest-se-2400.avif` | 2400 × 3200 | avif | 881,225 |
| `public/home-v4/dest-se-2400.webp` | 2400 × 3200 | webp | 1,278,068 |
| `public/home-v4/dest-se-3000.avif` | 3000 × 4000 | avif | 1,400,245 |
| `public/home-v4/dest-se-3000.webp` | 3000 × 4000 | webp | 1,917,552 |
| `public/home-v4/dest-se-1024.jpg` | 1024 × 1365 | jpg | 432,750 |

### dest-dk
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/dest-dk-640.avif` | 640 × 426 | avif | 39,404 |
| `public/home-v4/dest-dk-640.webp` | 640 × 426 | webp | 57,602 |
| `public/home-v4/dest-dk-1024.avif` | 1024 × 681 | avif | 87,173 |
| `public/home-v4/dest-dk-1024.webp` | 1024 × 681 | webp | 129,356 |
| `public/home-v4/dest-dk-1600.avif` | 1600 × 1064 | avif | 177,855 |
| `public/home-v4/dest-dk-1600.webp` | 1600 × 1064 | webp | 268,032 |
| `public/home-v4/dest-dk-2400.avif` | 2400 × 1596 | avif | 330,316 |
| `public/home-v4/dest-dk-2400.webp` | 2400 × 1596 | webp | 486,392 |
| `public/home-v4/dest-dk-3200.avif` | 3200 × 2128 | avif | 482,996 |
| `public/home-v4/dest-dk-3200.webp` | 3200 × 2128 | webp | 708,252 |
| `public/home-v4/dest-dk-4000.avif` | 4000 × 2660 | avif | 650,185 |
| `public/home-v4/dest-dk-4000.webp` | 4000 × 2660 | webp | 917,970 |
| `public/home-v4/dest-dk-1024.jpg` | 1024 × 681 | jpg | 226,783 |

### final-bg
| File | Width × height | Format | Bytes |
|---|---|---|---|
| `public/home-v4/final-bg-960.avif` | 960 × 640 | avif | 11,006 |
| `public/home-v4/final-bg-960.webp` | 960 × 640 | webp | 18,534 |
| `public/home-v4/final-bg-1600.avif` | 1600 × 1067 | avif | 25,339 |
| `public/home-v4/final-bg-1600.webp` | 1600 × 1067 | webp | 43,218 |
| `public/home-v4/final-bg-2400.avif` | 2400 × 1600 | avif | 62,882 |
| `public/home-v4/final-bg-2400.webp` | 2400 × 1600 | webp | 113,396 |
| `public/home-v4/final-bg-1600.jpg` | 1600 × 1067 | jpg | 210,419 |
