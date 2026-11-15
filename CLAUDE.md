# CLAUDE.md (SG Time Machine)

Follows `../CLAUDE.md` house rules (orchestrate, house style, safety, identity).

## Purpose
Public git-scraping archive of Singapore data.gov.sg live feeds plus a GitHub Pages time-slider map.

## Stack
Node 24 zero-dependency TypeScript fetcher (`scripts/`, run directly by Node type stripping) + Vite/TS/MapLibre site in `site/` (npm, `.nvmrc`, install with `npm ci --ignore-scripts`).

## Commands
- Snapshot: `npm run snapshot` (about 6 real network calls)
- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit: `npm test`
- Check: `npm run check` = typecheck + lint + unit
- Build: `npm run build`
- E2E: `npm run test:e2e`

## Rules
- `data/` is the archive, tracked in git on purpose. Never rewrite, delete or reformat it; history is the product. Format: `data/SCHEMA.md`.
- Stay under data.gov.sg rate limits (see `THIRD_PARTY_NOTICES.md`).
- Decisions: `docs/DECISIONS.md`. Resume: `docs/HANDOVER.md`.

## Verification
Tiers are defined only in root `../CLAUDE.md` section 4.

## Notes
Keep `docs/next-session.md` current (Before anything / How to work here / Current state / Known gaps).
