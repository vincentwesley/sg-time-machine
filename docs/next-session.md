> Update at the end of any session that changed state. Keep it lean.

Continue work on **SG Time Machine** (repo `vincentwesley/sg-time-machine`, live at https://vincentwesley.github.io/sg-time-machine/).
Handover 2026-11-15, M0–M4 merged, CI green. Open item: GitHub hasn't fired scheduled runs yet (see HANDOVER).

## Before anything
1. Pull `main` (the bot commits data). Read `docs/HANDOVER.md`, then `docs/NEEDS-VIN.md`.
2. Never rewrite `data/`.

## How to work here
Branch, PR, merge on green CI. Rules in `CLAUDE.md`. Checks: `npm run check`, `npm run build`, `npm run test:e2e`.

## Current state
Fetcher, site and rollup are live. The archive began 2026-11-15 14:01 SGT.

## Known gaps / ideas
1. Confirm a `schedule`-event snapshot run has succeeded.
2. First monthly release on 2026-12-02 (watch rollup.yml).
3. Report only the outcome and any owner actions.
