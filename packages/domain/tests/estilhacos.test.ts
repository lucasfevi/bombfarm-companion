import { describe, expect, it } from 'vitest';
import { ABILITIES, abilityMods } from '@bombfarm/domain/model';
import { computeFarmRates, computeHeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { SHATTER_FRAC } from '@bombfarm/domain/phase-wiki';
import wikiBundle from '@bombfarm/domain/data/phase-wiki.json' with { type: 'json' };
import { ownAbilityReadout } from '@bombfarm/domain/ability-effect-readout';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

describe('Estilhaços in the catalog', () => {
  it('is slot 21, 2.5% a level, and its shard share is the synced wiki bundle’s', () => {
    const index = ABILITIES.findIndex((ability) => ability.id === 'estilhacos');
    expect(index + 1).toBe(21);
    expect(ABILITIES[index].effect).toEqual({ kind: 'shatterPct', perLevel: 2.5 });
    expect(SHATTER_FRAC).toBe(wikiBundle.combat.shatterFrac);
    expect(SHATTER_FRAC).toBe(0.5);
  });

  it('reaches a 50% chance at rank 20 and moves no per-bomb damage', () => {
    const mods = abilityMods({ estilhacos: 20 });
    expect(mods.shatterChancePct).toBe(50);
    expect(mods.dmgMult).toBe(1);
    expect(ownAbilityReadout('estilhacos', 20)).toEqual({ kind: 'shatter', chancePct: 50, shardHitPct: 50 });
  });
});

describe('Estilhaços on the farm', () => {
  const { heroes, account, maxPhase } = loadFarmRateFixture();
  const subject = heroes[0]!;

  it('a carrier’s farm facts carry the chance as a fraction, and a hero without it carries none', () => {
    const [plain] = computeHeroFarmFacts({ heroes: [subject], account, enabledHeroIds: [subject.id] });
    const carrier = withAbilityLevels(subject, { estilhacos: 20 });
    const [facts] = computeHeroFarmFacts({ heroes: [carrier], account, enabledHeroIds: [carrier.id] });
    expect(plain!.shatterChance).toBeUndefined();
    expect(facts!.shatterChance).toBe(0.5);
  });

  it('raises gold per hour and shortens the clear on every phase the squad can clear', () => {
    const plain = computeFarmRates({ heroes, account, maxPhase });
    const carried = computeFarmRates({
      heroes: heroes.map((hero) => withAbilityLevels(hero, { estilhacos: 20 })),
      account,
      maxPhase,
    });
    for (const phase of [1, 25, 51, 101]) {
      const before = plain.rows[phase - 1];
      const after = carried.rows[phase - 1];
      if (!Number.isFinite(before.clearSecs)) continue;
      expect(after.clearSecs).toBeLessThan(before.clearSecs);
      expect(after.goldPerHour).toBeGreaterThan(before.goldPerHour);
    }
  });
});
