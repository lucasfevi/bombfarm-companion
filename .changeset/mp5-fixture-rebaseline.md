---
"@bombfarm/domain": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

**The pre-v4 capture corpus is removed and replaced.** The 2026-08-13 patch removed all five
keystones and wiped every account; the 41 committed capture files this repo's test suites were
built on described an account the game can no longer produce. The 20 `QUARANTINED (catalog v4,
2026-08-11)` suites and all 39 stale `sheet-math` fixtures (plus the old fidelity-gate capture
pair) are deleted, and the ~30 surviving suites that depended on them are re-pointed onto a new,
post-patch corpus: a scrubbed 2026-08-13 save export (`save-20260813-5heroes.json`, 5 heroes) and
an already-committed API-assembled payload (`payload-20260812-8heroes.json`, 8 heroes). The
fidelity-gate capture pair is re-captured from the new export and its eight-mutant discrimination
suite is re-proven red against it.

**No runtime behaviour changes for the web planner or the desktop.** This is a test-fixture and
test-suite rebaseline only — `packages/domain/src`, `apps/web/src` (non-test) and `packages/ui`
are untouched. `@bombfarm/desktop` is included because its recompute-budget test reads a fixture
this feature deletes (`apps/desktop/renderer/lib/planning/recompute-budget.test.ts`), not because
any desktop-rendered number changes.
