/**
 * Every suite currently held out of regime by `holdSuiteUntilInRegime` / `skipUnlessInRegime`
 * (packages/domain/tests/helpers/capture-regime.ts), one entry each.
 *
 * WHY THIS FILE EXISTS: a hold is a runtime `ctx.skip()`, so the static skip guards
 * (`source-surface.test.ts`, `fixture-corpus-parity.test.mjs`) cannot see it, and a held suite
 * reports green while running nothing. Recording each hold here turns it from a silent skip into
 * a reviewed decision: `rejected` must name every capture the registry deems admissible for the
 * suite's mechanic and say why the suite is not reading it. When a capture the suite CAN read
 * lands, the guard fails until the entry says why not — or the suite is re-pointed and the entry
 * is deleted. `tools/held-suite-manifest.test.mjs` enforces all of it.
 *
 * `capture` is one registry key, or an array when a suite is held on several captures at once.
 */

const FRESH_ACCOUNT =
  "four star-0 heroes at max_phase 21 with every item at +0: admissible only because no item is forged, which is also why it cannot stand in for a roster-scale claim about forged gear";

export const HELD_SUITES = [
  {
    suite: "apps/web/src/tests/import-merge.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/point-roundtrip.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/points-rank-golden.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/tree-crit-dmg-flat.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-486.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-budget-ceiling.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-degenerate.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-from-zero.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-frontier.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-objective.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-phase.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-plateau.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-rate-gain-pct.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-optimize-unspent-pool.test.ts",
    capture: "sheet-math/save-20260831-13heroes-soulbound.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-point-rank.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-rate-gate-throughput.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/point-roundtrip.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/points-rank-golden.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-canonicalize-assignment.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-level-budget.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-move-origin.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-solver-cache-memory.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-solver-moves.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-solver.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-step-monotonicity.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-waterfall.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/tree-crit-dmg-flat.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/collection.test.ts",
    capture: "sheet-math/save-20260914-20heroes-phase101.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/farm-rate-phase51-ato2-anchor.test.ts",
    capture: "sheet-math/save-20260823-13heroes-crit-points.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/flat-crit-cdr-shape.test.ts",
    capture: "sheet-math/save-20260818-12heroes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/ponta-diamante-flat.test.ts",
    capture: "sheet-math/payload-20260913-20heroes-runes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-combat-window.test.ts",
    capture: "sheet-math/save-20260819-11882-7heroes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-set-farm.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/post-boundary-exports-20260914.test.ts",
    capture: [
      "sheet-math/save-20260914-20heroes-phase101.json",
      "sheet-math/save-20260914-9heroes-second-account.json",
    ],
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/runes-live-read.test.ts",
    capture: "sheet-math/payload-20260913-20heroes-runes.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/skill-tree-pricing.test.ts",
    capture: "sheet-math/save-20260914-9heroes-second-account.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/flat-crit-cdr-shape.test.ts",
    capture: "sheet-math/save-20260818-12heroes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/import-runes.test.ts",
    capture: "sheet-math/payload-20260913-20heroes-runes.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/hero/src/model/power-breakdown-live-read.test.ts",
    capture: "sheet-math/payload-20260913-20heroes-runes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/hero/src/components/power-breakdown-panel.test.tsx",
    capture: "sheet-math/payload-20260913-20heroes-runes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-farm-objective.test.ts",
    capture: "sheet-math/save-20260831-13heroes-soulbound.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-farm-points.test.ts",
    capture: "sheet-math/save-20260831-13heroes-soulbound.json",
    mechanic: "sheet",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/team-plan-dps-golden.test.ts",
    capture: [
      "sheet-math/save-20260819-11882-7heroes.json",
      "sheet-math/save-20260823-13heroes-crit-points.json",
      "sheet-math/save-20260831-13heroes-soulbound.json",
    ],
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "packages/domain/tests/import-save-inventory.test.ts",
    capture: "sheet-math/save-20260819-11882-7heroes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/src/tests/import-inventory-sync.test.ts",
    capture: "sheet-math/save-20260819-11882-7heroes.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
  {
    suite: "apps/web/e2e/home.spec.ts",
    capture: "sheet-math/save-20260823-13heroes-crit-points.json",
    mechanic: "itemForge",
    rearmedBy:
      "a capture taken on or after 2026-10-06, once the forge table is in the sheet it was taken under, registered in the capture registry",
    rejected: {
      "sheet-math/save-20260828-4heroes-postpatch.json": FRESH_ACCOUNT,
    },
  },
];
