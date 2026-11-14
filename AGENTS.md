<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nextwise UI/UX baseline (all chats, all agents)

Before ANY UI work, read `docs/UI-UX-CANONICAL-BASELINE.md` and `docs/UI-UX-DEVELOPMENT-PROTOCOL.md`.
- Start from the tag `nextwise-ui-v563-approved`, or an approved integration baseline that contains it.
- Work on a uniquely named branch in an isolated worktree.
- `npm run verify:baseline` must pass, and `npm run verify:visual` must pass in Linux or CI.
- Never edit `src/config/ui-baseline/v563-manifest.json` or `tests/visual/__baseline__/` without the
  owner's approval (protocol §6).
- Never push or merge into `release/m10`: it is the Vercel production branch.
