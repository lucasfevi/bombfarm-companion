import { describe, expect, it } from 'vitest';
import { abilityMods } from '@bombfarm/domain/model';
import { expectedHitsToKill } from '@bombfarm/domain/model/clear-time';
import { computeCombatMults } from '@bombfarm/domain/derive';
import { computeFarmRates, computeHeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { binomialCdfBelow, hitsToKill, hitsToKillWithSecondBlast } from '@bombfarm/domain/phases';
import { SECOND_BLAST_FRAC } from '@bombfarm/domain/phase-wiki';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function simulatedBlastsToKill(hp: number, hit: number, critChance: number, critMult: number, chance: number): number {
  const random = lcg(20261020);
  const trials = 200_000;
  const roll = () => (random() < critChance ? hit * critMult : hit);
  let blasts = 0;
  for (let trial = 0; trial < trials; trial++) {
    let left = hp;
    while (left > 0) {
      blasts++;
      left -= roll();
      if (left > 0 && random() < chance) left -= roll() * SECOND_BLAST_FRAC;
    }
  }
  return blasts / trials;
}

describe('Detonação Dupla in hits-to-kill', () => {
  it('deals half of each hit on its second blast', () => {
    expect(SECOND_BLAST_FRAC).toBe(0.5);
  });

  it('a second blast changes nothing on a rock the first blast destroys', () => {
    expect(hitsToKillWithSecondBlast(10, 9, 0.5)).toBe(1);
    expect(expectedHitsToKill(9, 10, 0.3, 2, 0.5)).toBe(1);
    expect(expectedHitsToKill(9, 10, 1, 2, 0.5)).toBe(1);
  });

  it('a rock between one and one and a half hits dies to the first blast half the time at a 50% second-blast chance', () => {
    expect(hitsToKillWithSecondBlast(1, 1.2, 0.5)).toBeCloseTo(1.5, 12);
    expect(expectedHitsToKill(1.2, 1, 0, 2, 0.5)).toBeCloseTo(1.5, 12);
  });

  it('with no second-blast chance hits-to-kill is the one-blast figure bit for bit', () => {
    for (const hp of [0.5, 1, 1.7, 3.2, 9.99, 47, 250]) {
      expect(hitsToKillWithSecondBlast(1.3, hp, 0)).toBe(hitsToKill(1.3, hp));
      for (const critChance of [0, 0.25, 1]) {
        expect(expectedHitsToKill(hp, 1.3, critChance, 2.4, 0)).toBe(expectedHitsToKill(hp, 1.3, critChance, 2.4));
      }
    }
  });

  it('the second blast rolls its own crit', () => {
    // A non-crit first blast can be followed by a crit second one and the reverse, so one bomb
    // leaves a 2.6 HP rock standing three times in four; a shared roll would leave it twice.
    expect(expectedHitsToKill(2.6, 1, 0.5, 2, 1)).toBeCloseTo(1.75, 12);
  });

  it('matches a simulation of independent crit and second-blast rolls', () => {
    for (const [hp, critChance, critMult, chance] of [
      [7.3, 0.35, 2.2, 0.5],
      [3.1, 0.6, 3, 0.25],
      [12, 0.1, 1.6, 0.4],
    ] as const) {
      expect(expectedHitsToKill(hp, 1, critChance, critMult, chance)).toBeCloseTo(
        simulatedBlastsToKill(hp, 1, critChance, critMult, chance),
        1,
      );
    }
  });

  it('far past the exact sum, a blast is worth one plus half a blast at its chance, and the killing blast overshoots', () => {
    // One blast is 1 or 1.5 hits, half each: mean 1.25, mean square 1.625.
    expect(hitsToKillWithSecondBlast(1, 500, 0.5)).toBeCloseTo(500 / 1.25 + 1.625 / (2 * 1.25 ** 2), 9);
    expect(expectedHitsToKill(500, 1, 0, 2, 0.5)).toBeCloseTo(500 / 1.25 + 1.625 / (2 * 1.25 ** 2), 9);
    // Crit ×3 at half: the crit factor's mean is 2 and its mean square 5, each part rolling its own.
    const meanSquare = 5 * (1 + 0.5 * 0.25) + 2 * 0.5 * 0.5 * 2 ** 2;
    expect(expectedHitsToKill(500, 1, 0.5, 3, 0.5)).toBeCloseTo(500 / (2 * 1.25) + meanSquare / (2 * 2.5 ** 2), 9);
  });

  it('never needs more blasts as the second-blast chance rises, through a certain one', () => {
    for (const hp of [7.3, 59.3, 60.4, 103, 1_030]) {
      let previous = Infinity;
      for (let step = 0; step <= 200; step++) {
        const blasts = hitsToKillWithSecondBlast(1, hp, step / 200);
        expect(blasts, `hp ${hp}, chance ${step / 200}`).toBeLessThanOrEqual(previous + 1e-9);
        previous = blasts;
      }
    }
  });

  it('past the exact sum, no second blast and a certain one still read whole blasts, and the chances beside them approach those', () => {
    expect(hitsToKillWithSecondBlast(1, 103.3, 1e-9)).toBeCloseTo(104, 5);
    expect(hitsToKillWithSecondBlast(1, 103.3, 1)).toBeCloseTo(69, 9);
    expect(expectedHitsToKill(103.3, 1, 1e-9, 5, 0.5)).toBeCloseTo(hitsToKillWithSecondBlast(1, 103.3, 0.5), 5);
    expect(expectedHitsToKill(103.3, 1, 1 - 1e-9, 5, 0.5)).toBeCloseTo(hitsToKillWithSecondBlast(5, 103.3, 0.5), 5);
  });

  it('never needs more blasts as the crit chance rises, through a certain crit', () => {
    for (const hp of [7.3, 59.3, 60.4, 103, 1_030, 4_321.7]) {
      let previous = Infinity;
      for (let step = 0; step <= 200; step++) {
        const blasts = expectedHitsToKill(hp, 1, step / 200, 5, 0.5);
        expect(blasts).toBeLessThanOrEqual(previous + 1e-9);
        previous = blasts;
      }
    }
  });

  it('the binomial lower tail is empty below one, whole past the trials, and exact between', () => {
    expect(binomialCdfBelow(4, 0.5, 0)).toBe(0);
    expect(binomialCdfBelow(4, 0.5, 5)).toBe(1);
    expect(binomialCdfBelow(4, 1, 3)).toBe(0);
    expect(binomialCdfBelow(4, 0.5, 2)).toBeCloseTo(5 / 16, 12);
  });

  it('answers the same however many other crit chances were priced in between', () => {
    const first = expectedHitsToKill(7.3, 1, 0.35, 2.2, 0.5);
    for (let n = 1; n <= 600; n++) expectedHitsToKill(7.3, 1, n / 601, 2.2, 0.5);
    expect(expectedHitsToKill(7.3, 1, 0.35, 2.2, 0.5)).toBe(first);
  });

  it('a hit that deals nothing never kills, and a rock with no HP takes no blast', () => {
    expect(hitsToKillWithSecondBlast(0, 10, 0.5)).toBe(Infinity);
    expect(hitsToKillWithSecondBlast(5, 0, 0.5)).toBe(0);
    expect(expectedHitsToKill(10, 0, 0.3, 2, 0.5)).toBe(Infinity);
    expect(expectedHitsToKill(10, Infinity, 0.3, 2, 0.5)).toBe(Infinity);
    expect(expectedHitsToKill(0, 5, 0.3, 2, 0.5)).toBe(0);
  });

  it('a certain second blast always lands half a hit more, and a chance past 1 is a certain one', () => {
    expect(hitsToKillWithSecondBlast(1, 2.9, 1)).toBe(2);
    expect(hitsToKillWithSecondBlast(1, 2.9, 3)).toBe(2);
    expect(expectedHitsToKill(2.9, 1, 0, 2, 3)).toBe(2);
  });

  it('a hero that always crits, or whose crit adds nothing, prices its second blast on the one hit it deals', () => {
    expect(expectedHitsToKill(5, 1, 1, 2, 0.5)).toBe(hitsToKillWithSecondBlast(2, 5, 0.5));
    expect(expectedHitsToKill(5, 1, 0.4, 1, 0.5)).toBe(hitsToKillWithSecondBlast(1, 5, 0.5));
  });
});

describe('the two abilities in expected damage', () => {
  it('Misericórdia adds nothing to a hit or to expected damage', () => {
    const mods = abilityMods({ misericordia: 20 });
    expect(mods.dmgMult).toBe(1);
    expect(mods.secondBlastChance).toBe(0);
    expect(mods).toEqual(abilityMods({}));
  });

  it('Detonação Dupla’s expected damage per bomb is one blast plus half a blast at its chance', () => {
    const mods = abilityMods({ detonacao_dupla: 20 });
    expect(mods.secondBlastChance).toBe(0.5);
    expect(mods.dmgMult).toBe(1 + 0.5 * SECOND_BLAST_FRAC);
  });

  it('the DPS, gate, boss and duel damage paths carry 1 + 0.5 × chance, and one blast carries none of it', () => {
    const plain = computeCombatMults({ mods: abilityMods({}), teamBuffs: zeroTeamBuffs(), extraDmgPct: 0 });
    const carrier = computeCombatMults({ mods: abilityMods({ detonacao_dupla: 12 }), teamBuffs: zeroTeamBuffs(), extraDmgPct: 0 });
    expect(carrier.hitMult).toBe(plain.hitMult);
    expect(carrier.dmgMult).toBeCloseTo(plain.dmgMult * (1 + 0.3 * SECOND_BLAST_FRAC), 12);
  });
});

describe('the two abilities on the farm', () => {
  const { heroes, account, maxPhase } = loadFarmRateFixture();
  const subject = withAbilityLevels(heroes[0]!, { detonacao_dupla: 0, misericordia: 0 });
  const factsOf = (hero: typeof subject) =>
    computeHeroFarmFacts({ heroes: [hero], account, enabledHeroIds: [hero.id] })[0]!;

  it('a Detonação Dupla carrier’s average hit is one blast', () => {
    const carrier = withAbilityLevels(subject, { detonacao_dupla: 20 });
    const plain = factsOf(subject);
    const facts = factsOf(carrier);
    expect(facts.avgHitBase).toBe(plain.avgHitBase);
    expect(facts.hitNoCritBase).toBe(plain.hitNoCritBase);
    expect(facts.secondBlastChance).toBe(0.5);
    expect(plain.secondBlastChance).toBeUndefined();
  });

  it('a Detonação Dupla carrier’s extra damage per bomb is half a blast on each rock left standing, at its chance', () => {
    const rest = heroes.slice(1);
    const plain = computeFarmRates({ heroes: [subject, ...rest], account, maxPhase });
    const carried = computeFarmRates({
      heroes: [withAbilityLevels(subject, { detonacao_dupla: 20 }), ...rest],
      account,
      maxPhase,
    });
    let gained = 0;
    for (const [index, row] of carried.rows.entries()) {
      expect(row.goldPerHour).toBeGreaterThanOrEqual(plain.rows[index]!.goldPerHour);
      if (row.goldPerHour > plain.rows[index]!.goldPerHour) gained++;
    }
    expect(gained).toBeGreaterThan(0);
  });

  it('a hero carrying neither ability prices exactly as before, and Misericórdia prices as neither', () => {
    const mercy = withAbilityLevels(subject, { misericordia: 20 });
    expect(factsOf(mercy)).toEqual(factsOf(subject));
    const rest = heroes.slice(1);
    expect(computeFarmRates({ heroes: [mercy, ...rest], account, maxPhase }).rows).toEqual(
      computeFarmRates({ heroes: [subject, ...rest], account, maxPhase }).rows,
    );
  });
});
