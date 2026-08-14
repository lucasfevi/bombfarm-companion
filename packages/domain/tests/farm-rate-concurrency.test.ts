/**
 * Concurrency scaling.
 *
 * `concurrencyScale = min(1, fieldSlots / uptimeSum)` caps *simultaneous* throughput at the
 * field-slot count; it must not change per-hero *shares* (a hero's gold-ability effect is
 * independent of `fieldSlots` — the scale multiplies the whole squad rate uniformly).
 */
import { describe, expect, it } from 'vitest';
import { computeSquadFarmFacts, computeFarmRateRow, type HeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';
import { computeHeroFarmFacts } from '@bombfarm/domain/farm-rate';

const { heroes, account } = loadFarmRateFixture();

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

describe('concurrencyScale', () => {
  it('Σ uptime > fieldSlots ⇒ every rate scales by exactly fieldSlots / Σ uptime', () => {
    const heroesFacts: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'a', uptime: 1 }),
      syntheticHero({ heroId: 'b', uptime: 1 }),
      syntheticHero({ heroId: 'c', uptime: 1 }),
      syntheticHero({ heroId: 'd', uptime: 1 }),
    ];
    const crowded = { ...account, slots: 3 };
    const squad = computeSquadFarmFacts(heroesFacts, crowded);
    expect(squad.uptimeSum).toBe(4);
    expect(squad.concurrencyScale).toBeCloseTo(3 / 4, 12);

    // A scale-1 reference squad (same heroes, uncrowded field) isolates the scale factor.
    const uncrowded = { ...account, slots: 1000 };
    const referenceSquad = computeSquadFarmFacts(heroesFacts, uncrowded);
    expect(referenceSquad.concurrencyScale).toBe(1);

    const scaledRow = computeFarmRateRow(42, squad)!;
    const referenceRow = computeFarmRateRow(42, referenceSquad)!;
    expect(scaledRow.propsPerHour / referenceRow.propsPerHour).toBeCloseTo(3 / 4, 9);
    expect(scaledRow.goldPerHour / referenceRow.goldPerHour).toBeCloseTo(3 / 4, 9);
    expect(scaledRow.xpPerHour / referenceRow.xpPerHour).toBeCloseTo(3 / 4, 9);
  });

  it('Σ uptime < fieldSlots ⇒ scale 1, rates unchanged from the uncrowded reference', () => {
    const heroesFacts: HeroFarmFacts[] = [syntheticHero({ heroId: 'a', uptime: 1 })];
    const roomy = { ...account, slots: 9 };
    const squad = computeSquadFarmFacts(heroesFacts, roomy);
    expect(squad.uptimeSum).toBe(1);
    expect(squad.concurrencyScale).toBe(1);
  });

  it('the Σ uptime === fieldSlots boundary ⇒ scale exactly 1 (no scaling)', () => {
    const heroesFacts: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'a', uptime: 1 }),
      syntheticHero({ heroId: 'b', uptime: 1 }),
      syntheticHero({ heroId: 'c', uptime: 1 }),
    ];
    const exact = { ...account, slots: 3 };
    const squad = computeSquadFarmFacts(heroesFacts, exact);
    expect(squad.uptimeSum).toBe(3);
    expect(squad.concurrencyScale).toBe(1);
  });

  it('concurrencyScale cancels out of share — a hero\'s veia_ouro effect on gold is independent of fieldSlots', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const boostedJon = withAbilityLevels(jon, { veia_ouro: 10 });
    const heroesBoosted = heroes.map((h) => (h.id === jon.id ? boostedJon : h));

    const facts = computeHeroFarmFacts({ heroes: heroesBoosted, account });

    // The fixture's real Σ uptime is ≈0.96 across 5 heroes — `slots: 0.5` genuinely oversubscribes
    // it (unlike `slots: 1`, which is still >= Σ uptime and would leave concurrencyScale at 1).
    const crowded = { ...account, slots: 0.5 }; // heavily oversubscribed, scale << 1
    const roomy = { ...account, slots: 1000 }; // scale === 1

    const crowdedSquad = computeSquadFarmFacts(facts, crowded);
    const roomySquad = computeSquadFarmFacts(facts, roomy);
    expect(crowdedSquad.concurrencyScale).toBeLessThan(1);
    expect(roomySquad.concurrencyScale).toBe(1);

    const crowdedRow = computeFarmRateRow(42, crowdedSquad)!;
    const roomyRow = computeFarmRateRow(42, roomySquad)!;

    // goldPerHour is NOT identical (propsPerHour scales with concurrency) — but the RATIO of
    // goldPerHour to propsPerHour (i.e. the per-prop gold rate, which is what veia_ouro's share
    // acts on) is identical whether the field is crowded or roomy, proving concurrencyScale
    // cancels out of the per-hero share computation.
    const crowdedGoldPerProp = crowdedRow.goldPerHour / crowdedRow.propsPerHour;
    const roomyGoldPerProp = roomyRow.goldPerHour / roomyRow.propsPerHour;
    expect(crowdedGoldPerProp).toBeCloseTo(roomyGoldPerProp, 9);
  });
});
