/**
 * The pinned-phase fast path in `bestFarmPhase`, counted rather than asserted about.
 *
 * The claim this file exists for is a COST claim — "a pinned phase reads exactly one wiki row" —
 * and a cost claim asserted on its result is no claim at all: sweeping the table and returning the
 * pinned row would satisfy every value assertion here while being the thing this change exists to
 * avoid. So `computeFarmRateRow` is wrapped and its arguments recorded, and the test reads the
 * list of phases actually priced.
 *
 * The phase argmax is ~96% of a farm evaluation, and both the roster objective and the stat-point
 * search reach it through this one function — which is why the pin lives here and not in either
 * caller.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pricedPhases: number[] = [];

vi.mock('@bombfarm/domain/farm-rate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bombfarm/domain/farm-rate')>();
  return {
    ...actual,
    computeFarmRateRow: (
      phase: number,
      squad: Parameters<typeof actual.computeFarmRateRow>[1],
      options?: Parameters<typeof actual.computeFarmRateRow>[2],
    ) => {
      pricedPhases.push(phase);
      return actual.computeFarmRateRow(phase, squad, options);
    },
  };
});

const { computeHeroFarmBases, squadFactsFromBases } = await import('@bombfarm/domain/farm-rate');
const { bestFarmPhase, resolveFarmObjective } = await import(
  '@bombfarm/domain/farm-optimize-objective'
);
const { loadTeamPlanFarmFixture } = await import('./helpers/team-plan-farm-fixtures');

const GOLD = resolveFarmObjective({ kind: 'gold' });
const UNUSED_SCALES = { goldScale: 1, chestScale: 1 };
const CAPTURE = 'save-20260831-13heroes-soulbound.json';

function squadFor() {
  const fixture = loadTeamPlanFarmFixture(CAPTURE);
  const bases = computeHeroFarmBases({
    heroes: fixture.heroes,
    account: fixture.account,
    enabledHeroIds: fixture.enabledHeroIds,
  });
  return {
    squad: squadFactsFromBases(bases, null, fixture.account),
    maxPhase: fixture.account.maxPhase,
  };
}

describe('bestFarmPhase with a pinned phase', () => {
  beforeEach(() => {
    pricedPhases.length = 0;
  });

  it('prices exactly one row, and it is the pinned one', () => {
    const { squad, maxPhase } = squadFor();
    pricedPhases.length = 0;

    const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, { maxPhase, pinnedPhase: 151 });

    expect(pricedPhases).toEqual([151]);
    expect(pick?.phase).toBe(151);
  });

  it('an unpinned sweep prices many rows, so the count above is measuring something', () => {
    const { squad, maxPhase } = squadFor();
    pricedPhases.length = 0;

    bestFarmPhase(squad, GOLD, UNUSED_SCALES, { maxPhase });

    expect(pricedPhases.length).toBeGreaterThan(20);
  });

  it('outranks exhaustive — a caller that named a phase is not asking for an argmax', () => {
    const { squad, maxPhase } = squadFor();
    pricedPhases.length = 0;

    const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, {
      maxPhase,
      exhaustive: true,
      pinnedPhase: 51,
    });

    expect(pricedPhases).toEqual([51]);
    expect(pick?.phase).toBe(51);
  });

  it('prices a phase past maxPhase rather than excluding it, and marks the row locked', () => {
    const { squad } = squadFor();
    pricedPhases.length = 0;

    const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, { maxPhase: 10, pinnedPhase: 51 });

    expect(pricedPhases).toEqual([51]);
    expect(pick?.phase).toBe(51);
    expect(pick?.row.locked).toBe(true);
  });

  it('returns null, not some other phase, when the squad cannot hold the pinned one', () => {
    const { squad } = squadFor();
    pricedPhases.length = 0;

    const pick = bestFarmPhase(squad, GOLD, UNUSED_SCALES, { pinnedPhase: 600 });

    expect(pricedPhases).toEqual([600]);
    expect(pick).toBeNull();
  });

  it.each([
    ['null', null],
    ['NaN', Number.NaN],
    ['0', 0],
    ['601', 601],
  ])('ignores an unusable pin (%s) and sweeps as usual', (_label, pinnedPhase) => {
    const { squad, maxPhase } = squadFor();
    pricedPhases.length = 0;

    bestFarmPhase(squad, GOLD, UNUSED_SCALES, { maxPhase, pinnedPhase });

    expect(pricedPhases.length).toBeGreaterThan(20);
  });
});
