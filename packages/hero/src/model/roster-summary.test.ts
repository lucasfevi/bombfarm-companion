import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { equippedGearAverages, rosterSummaryFor } from './roster-summary';
import { item, rowFixture } from './showcase.test-fixture';

describe('rosterSummaryFor', () => {
  it('sums power over the squad only, leaving the bench out', () => {
    const summary = rosterSummaryFor([
      rowFixture({ id: 'a', power: 1000 }),
      rowFixture({ id: 'b', power: 500, battleAllowed: true }),
      rowFixture({ id: 'c', power: 9000, battleAllowed: false }),
    ]);
    expect(summary.squadPower).toBe(1500);
    expect(summary.squadCount).toBe(2);
    expect(summary.benchCount).toBe(1);
  });

  it('names the three strongest squad heroes, a benched hero never among them', () => {
    const summary = rosterSummaryFor([
      rowFixture({ id: 'a', name: 'Ada', power: 100 }),
      rowFixture({ id: 'b', name: 'Bo', power: 400 }),
      rowFixture({ id: 'c', name: 'Cy', power: 300 }),
      rowFixture({ id: 'd', name: 'Di', power: 200 }),
      rowFixture({ id: 'e', name: 'Ed', power: 999, battleAllowed: false }),
    ]);
    expect(summary.topSquadHeroes).toEqual([
      { id: 'b', name: 'Bo', power: 400 },
      { id: 'c', name: 'Cy', power: 300 },
      { id: 'd', name: 'Di', power: 200 },
    ]);
  });

  it('leaves a hero whose power was never read out of the sum and the top three', () => {
    const summary = rosterSummaryFor([rowFixture({ id: 'a', power: 50 }), rowFixture({ id: 'b' })]);
    expect(summary.squadPower).toBe(50);
    expect(summary.topSquadHeroes.map((hero) => hero.id)).toEqual(['a']);
  });

  it('counts rarities rarest first and omits the ones nobody holds', () => {
    const summary = rosterSummaryFor([
      rowFixture({ id: 'a', rarity: 'Comum' }),
      rowFixture({ id: 'b', rarity: 'Mítico' }),
      rowFixture({ id: 'c', rarity: 'Épico' }),
      rowFixture({ id: 'd', rarity: 'Comum', battleAllowed: false }),
      rowFixture({ id: 'e', rarity: 'Lendária' }),
    ]);
    expect(summary.rarityCounts).toEqual([
      { rarity: 'Mítico', count: 1 },
      { rarity: 'Lendária', count: 1 },
      { rarity: 'Épico', count: 1 },
      { rarity: 'Comum', count: 2 },
    ]);
  });

  it('carries the max phase only when the host gave one', () => {
    expect(rosterSummaryFor([], { maxPhase: 151 }).maxPhase).toBe(151);
    expect(rosterSummaryFor([], { maxPhase: null })).not.toHaveProperty('maxPhase');
    expect(rosterSummaryFor([])).not.toHaveProperty('maxPhase');
  });

  it('averages the gear squad heroes wear, benched heroes and empty slots left out', () => {
    const summary = rosterSummaryFor([
      rowFixture({ id: 'a', loadout: { ...emptyLoadout(), arma: item(100, 4), elmo: item(200, 8) } }),
      rowFixture({ id: 'b', loadout: { ...emptyLoadout(), peito: item(300, 0) } }),
      rowFixture({ id: 'c', loadout: { arma: item(10, 15) }, battleAllowed: false }),
      rowFixture({ id: 'd' }),
    ]);
    expect(summary.squadGear).toEqual({ itemCount: 3, averageLevel: 200, averageUpgrade: 4 });
  });
});

describe('equippedGearAverages', () => {
  it('gives no average when nothing is worn, rather than a zero', () => {
    expect(equippedGearAverages([rowFixture({ id: 'a' }).hero])).toEqual({ itemCount: 0 });
  });
});
