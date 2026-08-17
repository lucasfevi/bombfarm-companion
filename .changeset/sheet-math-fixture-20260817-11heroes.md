---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Adds a new `sheet-math` corpus fixture, `save-20260817-11heroes.json` — a scrubbed live save
export, the largest roster and highest phase captured to date (11 heroes; account `phase: 51`,
`max_phase: 62`). Test-only: no runtime source changed, and the fixture's item catalog matches
the shapes already committed in `save-20260816-9heroes-redistrib.json`.

Whole-roster round trip is verified issue-free on all 11 heroes (`inferSpentPoints` /
`composeSheetFromBirth`), every point budget lands exactly on `level`, and the corpus's
provenance manifest (`packages/domain/tests/fixtures/sheet-math/README.md`, mirrored at
`apps/web/src/tests/fixtures/sheet-math/README.md`) records what it may and may not prove — same
`stars: 0` / `stat_points_available: 0` limitation as the rest of the post-wipe corpus.

Two corpus-sweep guards move to account for the new file:
`packages/domain/tests/points-within-level-budget.test.ts`'s per-file hero-count map (now three
post-redistribution files, 25 heroes total), and `apps/web/src/tests/import-save.test.ts` gains a
real-fixture acceptance case so the fixture-corpus orphan sweep has a live consumer on the web
side too.
