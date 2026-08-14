/**
 * PFR item B, T10 (`R-B13`, `R-B17`, `R-B19`, `R-B3`, `AD-PFR-15`) — the performance guard.
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

describe('energySwitchPointCallCount — a function of roster size, not row count (AD-PFR-15)', () => {
  it('computeFarmRates over all 600 phases with the 5-hero fixture bumps the counter exactly 5 times', () => {
    const { heroes, account } = loadFarmRateFixture();
    computeFarmRates({ heroes, account });
    expect(energySwitchPointCallCount).toBe(5);
  });

  it('the same 5-hero roster over a SINGLE phase still bumps the counter exactly 5 times — the count is a function of roster size alone', () => {
    const { heroes, account } = loadFarmRateFixture();

    resetEnergySwitchPointCallCount();
    computeFarmRates({ heroes, account }); // all 600 phases
    const countForAll600 = energySwitchPointCallCount;

    resetEnergySwitchPointCallCount();
    const heroFacts = computeHeroFarmFacts({ heroes, account });
    const squad = computeSquadFarmFacts(heroFacts, account);
    computeFarmRateRow(42, squad); // a single phase
    const countForOnePhase = energySwitchPointCallCount;

    expect(countForAll600).toBe(5);
    expect(countForOnePhase).toBe(5);
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

  it('a 2-hero pool bumps the counter exactly 2 times (rules out a hardcoded constant)', () => {
    const { heroes, account } = loadFarmRateFixture();
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    computeFarmRates({ heroes, account, enabledHeroIds: twoIds });
    expect(energySwitchPointCallCount).toBe(2);
  });

  it('an empty pool bumps the counter 0 times', () => {
    const { heroes, account } = loadFarmRateFixture();
    computeFarmRates({ heroes, account, enabledHeroIds: [] });
    expect(energySwitchPointCallCount).toBe(0);
  });
});

describe('structural guard — farm-rate.ts import allowlist (R-B13 AC-4, R-B17, R-B19)', () => {
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
