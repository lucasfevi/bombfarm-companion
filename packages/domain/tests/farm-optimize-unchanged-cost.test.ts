/**
 * `unchangedRespecCostGold` — the mirror of `respecCostGold`. The advisor states the gold a
 * player does NOT have to spend, summed once over the heroes whose builds are already right,
 * rather than leaving them to add up a per-card figure themselves.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

describe('unchangedRespecCostGold', () => {
  it('sums the UNCHANGED heroes, exactly as respecCostGold sums the changed ones', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    const expected = result.heroes
      .filter((hero) => !hero.changed)
      .reduce((sum, hero) => sum + hero.respecCostGold, 0);
    expect(result.unchangedRespecCostGold).toBe(expected);
  });

  it('the two sums partition the roster — together they are every enabled hero\'s cost', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    const everyHero = result.heroes.reduce((sum, hero) => sum + hero.respecCostGold, 0);
    expect(result.respecCostGold + result.unchangedRespecCostGold).toBe(everyHero);
  });

  it('is a real figure on this fixture, not a vacuous zero', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    expect(result.heroes.some((hero) => !hero.changed)).toBe(true);
    expect(result.unchangedRespecCostGold).toBeGreaterThan(0);
  });
});
