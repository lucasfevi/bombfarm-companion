/**
 * The recompute budget's anti-drift deliverable — measured, not invented (design.md §2.2, §3,
 * tasks.md T6). The measured figures —
 * full-roster **~0.6 ms median / ~0.85 ms p95**, per-hero **~0.07 ms** — are written here and in
 * the CI `console.log` line: places that must agree, so a bound that quietly drifts from the
 * shipped code is a visible diff rather than a silent one (the silent-drift failure mode this
 * exists to close). F1 — owner of the two out-of-tree consumers of the deleted corpus — re-measured
 * these on the post-patch 8-hero payload fixture — the
 * deleted 11-hero fixture's figures (1.068 ms / 1.244 ms / 0.239 ms) no longer apply.
 *
 * Reads the domain package's own real-account fixture across the package boundary by relative
 * path — `packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json` (8 heroes, 27
 * catalogued items). F1 re-points this from the deleted pre-wipe 11-hero save
 * fixture onto the post-patch payload fixture — the richest real-sized roster artifact left in
 * the corpus. It does **not** add a file to `packages/domain` (absolute constraint 3):
 * duplicating the fixture here would create a second copy that drifts from the one
 * `pipeline-for-hero-parity.test.ts` asserts against.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
// T4 — re-pointed at the shared helper (design §5.7). Cross-package relative import of
// a TEST-ONLY source file: packages/domain's package.json `exports` map only publishes `dist/**`,
// so this cannot be a package-name import (`@bombfarm/domain/...`) — the helper is not part of
// the built package. The relative path mirrors FIXTURE_PATH below, which already crosses this
// same package boundary the same way.
import { requireFixture } from '../../../../../packages/domain/tests/helpers/require-fixture';

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'domain',
  'tests',
  'fixtures',
  'sheet-math',
  'payload-20260812-8heroes.json',
);

/**
 * Never skips, never early-returns on a missing fixture — this repo's "green without executing"
 * family has been hit six times (`AGENTS.md`/`tasks.md`'s own accounting); a cross-package fixture
 * read is a new surface for a seventh, so a missing file throws loudly with a fix-it message
 * instead of silently passing an empty suite.
 *
 * This suite's own guarantee is STRICTER than the shared `requireFixture`'s shape (which permits
 * a soft local-dev skip outside CI): a missing fixture always throws here, in and out of CI. The
 * shared helper is still called first — for the same named-assertion/CI-throw path every other
 * F4 artifact-dependent suite goes through — but its `false` return (the local-dev skip branch)
 * is deliberately NOT honoured with a `return`: the `readFileSync` below still throws on its own
 * when the file is genuinely absent, preserving this suite's pre-existing always-throw contract.
 */
function loadRecomputeBudgetFixture(): Record<string, unknown> {
  requireFixture(FIXTURE_PATH, 'recompute-budget full-roster / per-hero fixture read');

  let raw: string;
  try {
    raw = readFileSync(FIXTURE_PATH, 'utf8');
  } catch (err) {
    throw new Error(
      `recompute-budget.test.ts: could not read the domain fixture at ${FIXTURE_PATH} (${String(err)}). ` +
        'This test intentionally does not skip when the fixture is absent — restore ' +
        '`packages/domain/tests/fixtures/sheet-math/payload-20260812-8heroes.json` (it must not be copied ' +
        'into packages/domain\'s own tree or apps/desktop; F3 reads the committed domain fixture in place).',
    );
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

describe('recompute budget — the measured figure, asserted against itself', () => {
  const raw = loadRecomputeBudgetFixture();
  const parsed = parseAccountPayload(raw, []);

  it('the fixture actually parses 8 heroes and a tree (sanity — otherwise this test proves nothing)', () => {
    expect(parsed.rejected).toBeNull();
    expect(parsed.candidates.length).toBe(8);
    expect(parsed.account.tree).not.toBeNull();
  });

  const heroes: HeroRecord[] = parsed.candidates.map((candidate) => ({
    ...candidate.record,
    id: candidate.sourceId,
    updatedAt: Date.now(),
  }));

  const accountData = parsed.account;
  const tree = accountData.tree;
  if (!tree) throw new Error('fixture must carry a skill tree for this budget test');
  const rawPhase = accountData.phase;
  if (rawPhase == null) throw new Error('fixture must carry account.phase for this budget test');
  const phase: number = rawPhase;
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');
  const mitigationPct = line.mitig * 100;

  // Assembled exactly as `apps/desktop/renderer/lib/planning/account-model.ts`'s
  // `buildPlanningModel` assembles `AccountShared` — same field list, same fallback shape.
  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
    },
    teamBuffs: zeroTeamBuffs(),
    context: {
      houseIdx: accountData.houseIdx ?? 0,
      houseLevel: accountData.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    slots: accountData.slots ?? undefined,
  };

  function computeFullRoster(): void {
    for (const hero of heroes) {
      pipelineForHero(hero, account, phase, mitigationPct);
    }
  }

  const WARMUP_ITERATIONS = 5;
  const MEASURED_ITERATIONS = 20;

  function measureFullRosterMedianMs(): { medianMs: number; p95Ms: number } {
    for (let i = 0; i < WARMUP_ITERATIONS; i++) computeFullRoster();
    const samples: number[] = [];
    for (let i = 0; i < MEASURED_ITERATIONS; i++) {
      const started = performance.now();
      computeFullRoster();
      samples.push(performance.now() - started);
    }
    return { medianMs: median(samples), p95Ms: percentile95(samples) };
  }

  it(
    // One 60 Hz animation frame (16 ms) — the threshold below which the recompute cannot drop a
    // frame, which is what MAR-15's "the window stays interactive" means. F1
    // re-measured on the post-patch 8-hero payload fixture (Node v24.16.0, Windows 11 Pro
    // 26200, dev machine, warm, 5 warm-up iterations discarded): median ~0.6 ms, p95 ~0.85 ms,
    // over several 20-run samples — reproduced here over this test's own 20-run sample. 16 ms
    // is ~19x the measured p95: headroom for CI-runner slowdown and a fixture-size regression,
    // while still failing a genuine order-of-magnitude regression.
    'full 8-hero roster completes in < 16 ms (one 60 Hz frame) — measured ~0.6 ms median / ~0.85 ms p95',
    () => {
      const { medianMs, p95Ms } = measureFullRosterMedianMs();
      // The measured-not-invented recompute budget requires the observed value in the CI log, not only a pass/fail bit
      // (team-plan-solver.test.ts's own precedent). This repo's eslint config has no `no-console`
      // rule, so no disable comment is needed here (unlike the domain suite's own copy of this
      // pattern, which predates that check).
      console.log(
        `recompute-budget: full-roster (8 heroes) medianMs=${medianMs.toFixed(3)} p95Ms=${p95Ms.toFixed(3)}`,
      );
      expect(medianMs).toBeLessThan(16);
    },
  );

  it(
    // Exists so the bound keeps discriminating if the fixture ever shrinks: the whole-roster
    // bound alone would stop meaning anything against a 1-hero fixture. F1 re-measured:
    // per-hero ~0.07 ms — 2 ms is ~28x that.
    'normalised per hero completes in < 2 ms — measured ~0.07 ms per hero',
    () => {
      const { medianMs } = measureFullRosterMedianMs();
      const perHeroMs = medianMs / heroes.length;
      console.log(`recompute-budget: per-hero medianMs=${perHeroMs.toFixed(4)} (heroes=${String(heroes.length)})`);
      expect(perHeroMs).toBeLessThan(2);
    },
  );

  it.skip('demonstrates the red state: looping the roster 80x blows the whole-roster budget (observed, then discarded — not committed as a permanent mutation)', () => {
    // F1: the multiplier is re-measured, not scaled arithmetically — the smaller 8-hero
    // fixture runs fast enough (~0.6 ms/iteration) that the old 20x loop (~12 ms) no longer
    // reliably clears the 16 ms bound. 40x (~24 ms at the observed median, ~21 ms at the
    // observed low end) does, with margin.
    function computeFullRosterLooped80x(): void {
      for (let loop = 0; loop < 80; loop++) {
        computeFullRoster();
      }
    }
    for (let i = 0; i < WARMUP_ITERATIONS; i++) computeFullRosterLooped80x();
    const samples: number[] = [];
    for (let i = 0; i < MEASURED_ITERATIONS; i++) {
      const started = performance.now();
      computeFullRosterLooped80x();
      samples.push(performance.now() - started);
    }
    const loopedMedianMs = median(samples);
    // The bound this test's siblings assert (< 16 ms) is demonstrably exceeded by an artificially
    // inflated workload — proof the assertion above is discriminating, not a bound nobody could
    // ever fail. (This it() intentionally checks the OPPOSITE direction from the real assertions;
    // it is not itself a regression guard, it is evidence the regression guard has teeth.)
    expect(loopedMedianMs).toBeGreaterThan(16);
  });
});
