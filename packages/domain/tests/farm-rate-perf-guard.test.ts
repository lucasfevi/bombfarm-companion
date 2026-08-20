/**
 * The performance guard.
 *
 * `energySwitchPointCallCount` is bumped exactly once per `computeAdvisorPipeline` call
 * (`advisor-pipeline.ts:271`), unconditionally — so "count after − count before" is exactly the
 * number of pipeline invocations. Import it here ONLY (test-only); `src/farm-rate.ts` must never
 * import `advisor-pipeline` — the structural case below scans the real source file to prove it.
 *
 * This file owns the counter cases exclusively (§Parallelism in tasks.md): the counter is
 * module-global mutable state, so a parallel file calling the pipeline would corrupt the count.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import {
  computeFarmRates,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateTable,
  computeFarmRateRow,
} from '@bombfarm/domain/farm-rate';
import { requireFixture } from './helpers/require-fixture';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const DOMAIN_ROOT = join(__dirname, '..');
const FARM_RATE_SRC = join(DOMAIN_ROOT, 'src', 'farm-rate.ts');

beforeEach(() => {
  resetEnergySwitchPointCallCount();
});

/**
 * TWO passes per hero, not one — `computeHeroFarmBases` prices the team auras over the rotation,
 * which needs every hero's uptime, which only the pipeline produces (see that function's own
 * note). The invariant this file guards is unchanged and is the one in its title: the count is a
 * fixed multiple of ROSTER SIZE and never a function of the 600 rows. `N` when
 * `account.teamBuffsOverride` is set — a hand-typed total needs no second pass to weight.
 */
const PASSES_PER_HERO = 2;

describe('energySwitchPointCallCount — a function of roster size, not row count', () => {
  it('computeFarmRates over all 600 phases with the 5-hero fixture bumps the counter exactly 2x5 times', () => {
    const { heroes, account } = loadFarmRateFixture();
    computeFarmRates({ heroes, account });
    expect(energySwitchPointCallCount).toBe(PASSES_PER_HERO * 5);
  });

  it('an explicit teamBuffs override collapses to ONE pass per hero', () => {
    const { heroes, account } = loadFarmRateFixture();
    computeFarmRates({ heroes, account: { ...account, teamBuffsOverride: { grito_guerra: 20 } } });
    expect(energySwitchPointCallCount).toBe(5);
  });

  it('the same 5-hero roster over a SINGLE phase still bumps the counter exactly 2x5 times — the count is a function of roster size alone', () => {
    const { heroes, account } = loadFarmRateFixture();

    resetEnergySwitchPointCallCount();
    computeFarmRates({ heroes, account }); // all 600 phases
    const countForAll600 = energySwitchPointCallCount;

    resetEnergySwitchPointCallCount();
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    computeFarmRateRow(42, squad); // a single phase
    const countForOnePhase = energySwitchPointCallCount;

    expect(countForAll600).toBe(PASSES_PER_HERO * 5);
    expect(countForOnePhase).toBe(PASSES_PER_HERO * 5);
    expect(countForOnePhase).toBe(countForAll600);
  });

  it('a pre-computed SquadFarmFacts costs a counter delta of 0 across computeFarmRateTable', () => {
    const { heroes, account } = loadFarmRateFixture();
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    resetEnergySwitchPointCallCount();
    computeFarmRateTable(squad); // all 600 rows
    expect(energySwitchPointCallCount).toBe(0);
  });

  it('a 2-hero pool bumps the counter exactly 2x2 times (rules out a hardcoded constant)', () => {
    const { heroes, account } = loadFarmRateFixture();
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    computeFarmRates({ heroes, account, enabledHeroIds: twoIds });
    expect(energySwitchPointCallCount).toBe(PASSES_PER_HERO * 2);
  });

  it('an empty pool bumps the counter 0 times', () => {
    const { heroes, account } = loadFarmRateFixture();
    computeFarmRates({ heroes, account, enabledHeroIds: [] });
    expect(energySwitchPointCallCount).toBe(0);
  });
});

describe('structural guard — farm-rate.ts import allowlist', () => {
  it('does NOT import ./advisor-pipeline, ./advisor-tables, ./points-reopt, or ./derive', () => {
    if (!requireFixture(FARM_RATE_SRC, 'farm-rate.ts import-allowlist scan')) return;
    const source = readFileSync(FARM_RATE_SRC, 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.\/advisor-pipeline['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/advisor-tables['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/points-reopt['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/derive['"]/);
  });

  it('DOES import pipelineForHero from ./roster-dps (AD-032 — the sole pipeline entry)', () => {
    if (!requireFixture(FARM_RATE_SRC, 'farm-rate.ts import-allowlist scan')) return;
    const source = readFileSync(FARM_RATE_SRC, 'utf8');
    expect(source).toMatch(/pipelineForHero/);
    expect(source).toMatch(/from\s+['"]\.\/roster-dps['"]/);
  });
});
