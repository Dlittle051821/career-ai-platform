# V5.4 portrait layer: how it was made

The V5.4 page uses exactly the same approved portrait as V5 and V5.1 (byte-identical file, shipped as `public/home-v54/v54-portrait.png`) so V5.4 installs and uninstalls independently of the earlier previews.

**Source.** The approved Nextwise V5 reference image (1586 × 992, flattened). No separate portrait layer was supplied, so the subject was extracted from the reference itself. No other photograph or generated face was used.

## Steps

The scripts are in the package under `tools/portrait/`.

1. **Crop and occluder mask.** The portrait region is the reference area x 320–1250, y 370–957 (930 × 587 px). The reference portrait is pure black and white, while every card, the glass band and the picture tiles carry a blue tint. Pixels with `blue − red > 7`, cleaned up and with enclosed text and icons included, therefore mark everything in front of him.
2. **Head silhouette.** The visible hair, face and neck give the convex hull of the head. Hidden pixels inside the hull belong to the student; hidden pixels outside it are background. The hull edge is roughened into curls so it is not a straight line.
3. **Reconstruction of hidden areas:**
   - **Skin, ear and temple** (behind "Career Intelligence"): LaMa inpainting (ONNX, Carve/LaMa-ONNX, Apache-2.0).
   - **Curls on top of the head** (behind "Which university?"): patch synthesis from his own visible curls, matched to the local lighting.
   - **Right-hand curls** (behind "Study Abroad?"): LaMa.
   - Seams are feathered.
4. **Matte.** The matte combines ISNet and U²-Net human segmentation with a luminance key for fine hair against the paper, then removes edge spill. The bottom edge is kept solid where the shirt meets the frame.
5. **Upscale.** EDSR ×2 super-resolution (OpenCV `dnn_superres`), then the alpha is re-derived. The output is 1860 × 1174 RGBA, about 2.2 source pixels per CSS pixel at 1440 × 900. It is served through `next/image`, which generates AVIF and WebP at the rendered size.

## What is reconstructed rather than original

About 16% of the portrait's area:

- the curls at the top-left of the head;
- the top of the ear and a strip of the left temple;
- a band of hair above the ear;
- a few curls on the right.

At normal viewing size they read as natural hair and skin. On close inspection the synthesised curls are softer and more repetitive than the originals.

## Resolution limit

The reference portrait is about 930 px wide. Super-resolution restores convincing detail for 2× screens at 1440 px wide; on larger Retina displays the face is noticeably softer than a native photograph would be.

## Rights

The approved image appears to depict the same person as the model in the Mindly reference used earlier in this project. Before any public use, confirm that Nextwise holds the rights to this person's likeness and to the photograph the reference was made from. The clean fix is an original, licensed shoot (same pose and lighting), dropped into `public/home-v54/v54-portrait.png` at the same framing.
