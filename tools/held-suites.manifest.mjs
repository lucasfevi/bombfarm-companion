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

export const HELD_SUITES = [];
