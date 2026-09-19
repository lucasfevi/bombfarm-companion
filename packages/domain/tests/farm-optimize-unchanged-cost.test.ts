/**
 * `unchangedRespecCostGold` — the mirror of `respecCostGold`. The advisor states the gold a
 * player does NOT have to spend, summed once over the heroes whose builds are already right,
 * rather than leaving them to add up a per-card figure themselves.
 *
 * The two used to partition the roster, because every proposal was a transfer and so every
 * changed hero owed a reset. They no longer do: a proposal that only ADDS places points the game
 * already granted, which is free, so such a hero pays nothing AND is not already right. Each
 * figure is rendered under copy naming the heroes it covers, so neither may quietly absorb that
 * third case — the accounting below is three-way on purpose.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecHeroEntry } from '@bombfarm/domain/farm-optimize';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

/** Pays nothing and is not unchanged — the third bucket. */
function addsOnly(hero: FarmRespecHeroEntry): boolean {
  return hero.changed && !hero.requiresReset;
}

describe('unchangedRespecCostGold', () => {
  it('sums the UNCHANGED heroes, exactly as respecCostGold sums the ones that owe a reset', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    const expected = result.heroes
      .filter((hero) => !hero.changed)
      .reduce((sum, hero) => sum + hero.respecCostGold, 0);
    expect(result.unchangedRespecCostGold).toBe(expected);
  });

  it('the two sums plus the add-only heroes account for every enabled hero', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    const everyHero = result.heroes.reduce((sum, hero) => sum + hero.respecCostGold, 0);
    const addsOnlyCost = result.heroes.filter(addsOnly).reduce((sum, hero) => sum + hero.respecCostGold, 0);
    expect(result.respecCostGold + result.unchangedRespecCostGold + addsOnlyCost).toBe(everyHero);
  });

  it('is a real figure, not a vacuous zero: re-solved from its own answer, every hero is unchanged and still priced', () => {
    // The first solve of this fixture now changes every hero (the standing-props clear moved its
    // optimum), so the unchanged sum is taken on the re-solve from the proposed build, where
    // nothing moves and every hero's would-be reset cost lands in this field.
    const first = solveFarmRespec({ heroes, account, maxPhase });
    const proposed = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const result = solveFarmRespec({ heroes: proposed, account, maxPhase });

    expect(result.heroes.some((hero) => !hero.changed)).toBe(true);
    expect(result.unchangedRespecCostGold).toBeGreaterThan(0);
  });
});
