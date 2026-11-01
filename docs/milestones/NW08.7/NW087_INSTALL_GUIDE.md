# NW08.7 · Local viewing instructions

The Motion Lab runs only in development (`npm run dev`) and returns 404 in any production build.

## 1. Check the files are in place

In PowerShell:

```powershell
cd C:\carrier.ai
git status --short
```

You should see these new, untracked folders (plus one modified file, `vitest.config.mts`):

```
 M vitest.config.mts
?? docs/milestones/NW08.7/
?? src/app/motion-lab/
?? src/components/motion-lab/
?? src/lib/motion-lab/
```

There are no new packages to install. `motion@14.9.0` is already in the project (`npm ls motion`).

## 2. Verify

```powershell
npx tsc --noEmit
npx vitest run src/lib/motion-lab
npm test
npm run build
```

Expected: no type errors; 61 Motion Lab tests pass; the full suite passes 2,466 tests across 145 files (2,405 before NW08.7 plus 61 new); the build completes.

Optional production check: run `npm run start` after the build, then open `http://localhost:3000/motion-lab`. It should show a 404 page.

## 3. View the prototypes

```powershell
npm run dev
```

Open:

| URL | What |
|---|---|
| http://localhost:3000/motion-lab | Gallery and comparison |
| http://localhost:3000/motion-lab/living-path | Concept A |
| http://localhost:3000/motion-lab/unfolding-future | Concept B |
| http://localhost:3000/motion-lab/window-to-tomorrow | Concept C |

Add `?motion=reduced` to a concept URL to see its reduced-motion version. To test the OS setting instead:
- **Windows:** Settings → Accessibility → Visual effects → Animation effects **Off**.
- **macOS:** System Settings → Accessibility → Display → Reduce motion.
- **Chrome DevTools:** ⋮ → More tools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`.

### Controls (development only)

The scrubber bar at the bottom of each concept page has:
- **Restart** to return to the top of the story
- **1–4** to jump to each stage
- a **slider** to scrub progress by hand (it moves the real scroll position, so the wheel and the slider always agree)
- **Hide** to collapse the bar

"Skip to the paths" (top right of the story) jumps past the animation to the list of entry points.

### On a phone

Run `npm run dev -- -H 0.0.0.0`, then open `http://<your-PC's-LAN-IP>:3000/motion-lab` on a phone on the same Wi-Fi network.

## 4. Remove (if not wanted)

Delete the three `motion-lab` folders and `docs/milestones/NW08.7`, and remove the single `src/lib/motion-lab/**/*.test.ts` line from `vitest.config.mts`. Nothing else depends on them.
