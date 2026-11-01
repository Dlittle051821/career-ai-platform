# NW08.7 · H12 · Rollback instructions

Nothing is committed, so every rollback below is local and immediate.

## 0. Production today needs no rollback

`/` renders the signature hero only when `NEXTWISE_HOMEPAGE_HERO=signature` is set at build time. That variable is not set in this repository, in `.env*` files or in Vercel. With these files merged as they are, the live homepage is the current approved homepage.

## 1. After the hero has been switched on: switch it off

Remove `NEXTWISE_HOMEPAGE_HERO` (or set it to anything other than `signature`) in the environment that builds the site, then redeploy. The homepage is statically rendered, so a rebuild is required; that one variable is the whole rollback.

## 2. Remove the signature hero from the codebase entirely

In PowerShell, from `C:\carrier.ai`:

```powershell
# Restore the three existing files this milestone edited
git checkout -- "src/app/(site)/page.tsx" src/components/registration-prompt/RegistrationPrompt.tsx src/lib/registration-prompt/event-bus.ts

# Delete the new files
Remove-Item -Recurse -Force src/components/sections/home/signature, src/lib/home/signature-hero, "src/app/(site)/homepage-preview"
```

Then run `npx tsc --noEmit` and `npm test`. The suite returns to its pre-hero count (all signature-hero tests live in the deleted folder).

The Motion Lab prototypes (`src/app/motion-lab`, `src/components/motion-lab`, `src/lib/motion-lab`, plus one line in `vitest.config.mts`) are independent and have their own removal steps in `NW087_INSTALL_GUIDE.md`.

## 3. Keep the hero but undo the registration-prompt coordination

Restore only `RegistrationPrompt.tsx` and `event-bus.ts` with the `git checkout` above, then remove the `setRegistrationPromptHold` import and `useEffect` from `SignatureHero.tsx`. The prompt then behaves exactly as in NW08.5. It could open over the hero story after 45 seconds of engaged time.

## Files at a glance

| Kind | Path |
|---|---|
| Edited | `src/app/(site)/page.tsx`, `src/components/registration-prompt/RegistrationPrompt.tsx`, `src/lib/registration-prompt/event-bus.ts` |
| New | `src/components/sections/home/signature/*`, `src/lib/home/signature-hero/*`, `src/app/(site)/homepage-preview/page.tsx`, `docs/milestones/NW08.7/NW087_H*.md`, `docs/milestones/NW08.7/evidence/homepage/*` |
| Untouched (the original homepage) | `src/components/sections/home/HomeHero.tsx` and every other homepage section |
