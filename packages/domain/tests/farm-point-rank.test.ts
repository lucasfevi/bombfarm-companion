/**
 * The farm-mode next-point scorer. Every case here is measured on the committed fixture
 * (`save-20260813-5heroes.json`, pool = all 5 heroes, gold objective, return bonus off,
 * `maxPhase 42` unless stated) — figures are recorded from a real run, not hand-derived.
 */
import { describe, expect, it } from 'vitest';
import {
  rankNextPointForFarm,
  computeHeroFarmBases,
  FARM_RANK_MAX_EVALUATIONS,
  type FarmPointRankResult,
} from '@bombfarm/domain/farm-point-rank';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { RANK_STATS } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();
const bases = computeHeroFarmBases({ heroes, account });

function heroByName(name: string): HeroRecord {
  const hero = heroes.find((h) => h.name === name);
  if (!hero) throw new Error(`fixture hero "${name}" not found`);
  return hero;
}

/** Finite/non-NaN sweep over every numeric field a result can carry — a failure never surfaces
 *  as `NaN` or `Infinity`, only as a named `outcome`. */
function assertResultIsFinite(result: FarmPointRankResult): void {
  expect(Number.isNaN(result.evaluations), 'evaluations is NaN').toBe(false);
  expect(Number.isFinite(result.evaluations), 'evaluations is not finite').toBe(true);
  if (result.phase !== null) {
    expect(Number.isNaN(result.phase), 'phase is NaN').toBe(false);
    expect(Number.isFinite(result.phase), 'phase is not finite').toBe(true);
  }
  if (result.rows !== null) {
    for (const row of result.rows) {
      expect(Number.isNaN(row.gainPct), `${row.stat} gainPct is NaN`).toBe(false);
      expect(Number.isFinite(row.gainPct), `${row.stat} gainPct is not finite`).toBe(true);
    }
  }
}

describe('rankNextPointForFarm — discrimination: a one-shotting squad inverts the two ranking modes', () => {
  const bellatrix = heroByName('Bellatrix');

  // RE-TUNED at the 2026-08-15 patch. This used to sweep [42, 5, 1]; Bellatrix no longer
  // one-shots at maxPhase 42 (her attack now scores 0.5721, not 0) because crit chance became a
  // flat addend and her DPS fell with it. The regime move is REAL, so it is pinned below as its
  // own case rather than deleted — and the one-shot claim keeps a top-of-ladder subject via Jon,
  // who still one-shots at every phase on this fixture.
  it.each([20, 5, 1])('at maxPhase %i: farm scores attack exactly 0 while energy and speed are positive', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    const rows = result.rows!;
    const attack = rows.find((r) => r.stat === 'attack')!;
    const energy = rows.find((r) => r.stat === 'energy')!;
    const speed = rows.find((r) => r.stat === 'speed')!;
    expect(attack.gainPct).toBe(0);
    expect(energy.gainPct).toBeGreaterThan(0);
    expect(speed.gainPct).toBeGreaterThan(0);
    assertResultIsFinite(result);
  });

  it.each([42, 5, 1])('at maxPhase %i: Jon still one-shots — attack exactly 0, energy and speed positive', (mp) => {
    const jon = heroByName('Jon');
    const result = rankNextPointForFarm({ bases, account, heroId: jon.id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    const rows = result.rows!;
    expect(rows.find((r) => r.stat === 'attack')!.gainPct).toBe(0);
    expect(rows.find((r) => r.stat === 'energy')!.gainPct).toBeGreaterThan(0);
    expect(rows.find((r) => r.stat === 'speed')!.gainPct).toBeGreaterThan(0);
    assertResultIsFinite(result);
  });

  it('Bellatrix does not one-shot at maxPhase 42', () => {
    // The discrimination this file rests on is that a one-shotting hero scores attack at exactly
    // 0. Bellatrix crossed out of that regime at the 2026-08-15 patch (crit chance going flat)
    // and STAYS out of it after the 2026-08-18 revert back to percent-of-base: the item catalog
    // and level-cap restructure that landed alongside both crit-chance patches is what keeps her
    // damage per bomb below a one-shot on a phase-42 prop, independent of the crit shape.
    // RE-MEASURED for the 2026-08-18 revert (issue #132), and again for issue #132's team-aura
    // roster shape: this fixture's account.teamBuffs is zeroTeamBuffs() (production's
    // post-import default before the auto-fill button is pressed — farm-rate-fixtures.ts), so
    // Jon's own folego_mineiro rank no longer silently boosts his own drain the way the old
    // model let it. Jon's uptime shift ripples into the squad-level House allocation every
    // hero's farm ranking reads, moving Bellatrix's own gainPct even though nothing about her
    // build changed.
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const attack = result.rows!.find((r) => r.stat === 'attack')!;
    expect(attack.gainPct).toBeGreaterThan(0);
    expect(attack.gainPct).toBeCloseTo(0.8015745448860301, 5);
  });

  it('farm ranks ENERGY first at maxPhase 42 — the order INVERTED when cadence stopped assuming every plant is walk-bound', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const rows = result.rows!;
    // This test used to assert speed first, energy second. The inversion is the point, and it is
    // a consequence of fixing the cadence model rather than of tuning anything.
    //
    // The retired `cycle = max(fuse, E_D_CELLS / walkSpeed)` put EVERY plant on the walk branch
    // at fixture speeds, so a speed point shortened every single cycle and speed looked
    // dominant (1.1170). Averaging over the measured hop distribution, roughly 45% of plants are
    // short enough to be fuse-bound, where speed buys nothing at all — so speed's marginal value
    // falls by ~41% (1.1170 → 0.6612) while energy barely moves (0.8999 → 0.9011, since a point
    // of energy still buys the same extra field seconds). Energy overtakes it.
    //
    // The same correction is why `cdr` stopped scoring exactly 0 further down this file: the
    // fuse-bound mass that speed cannot help is precisely the mass CDR can.
    // RE-MEASURED for the 2026-08-18 revert (issue #132) — crit chance/CDR moved back to
    // percent-of-base, shifting both figures slightly; the energy-first order is unchanged.
    //
    // RE-MEASURED again for issue #132's team-aura roster shape: this fixture's
    // account.teamBuffs is zeroTeamBuffs(), so Jon (folego_mineiro 18 own rank, elsewhere in
    // this same 5-hero roster) loses the own-rank leak the old model let through — his uptime
    // falls, which shifts the squad-level House-allocation contention every hero's farm ranking
    // reads, Bellatrix included, even though nothing about HER build changed. That ripple moves
    // attack enough to overtake speed for second place (0.802 vs 0.700) — the title is trimmed
    // to the part of the claim that still holds (energy first); the full order is asserted below
    // instead of pinning a "second place" that is no longer the discriminating claim.
    expect(rows[0]).toEqual({ stat: 'energy', label: 'Energia', gainPct: 0.854075763565687 });
    expect(rows[1]).toEqual({ stat: 'attack', label: 'Ataque', gainPct: 0.8015745448860301 });
    expect(rows[2]).toEqual({ stat: 'speed', label: 'Velocidade', gainPct: 0.7004826079100468 });
  });

  it('DPS mode scores attack first and speed exactly 0 on the same hero (the inversion)', () => {
    const line = account.context;
    const dps = pipelineForHero(bellatrix, account, line.phase, line.mitigationPct);
    expect(dps.ranking[0].stat).toBe('attack');
    expect(dps.ranking[0].gainPct).toBeGreaterThan(0);
    const speed = dps.ranking.find((r) => r.stat === 'speed')!;
    expect(speed.gainPct).toBe(0);
  });
});

describe('rankNextPointForFarm — anti-"energy always wins" sensor', () => {
  // RE-TUNED at the 2026-08-15 patch. This used to sweep ['Lyra', 'Perrin'] at maxPhase 42.
  // Perrin L4 no longer demonstrates the claim there — measured attack 0.128027 against energy
  // 0.142847, a genuine flip driven by the flat crit change, not by this sensor's logic. Rather
  // than pin a hero that no longer shows the effect, the sensor keeps the subject that does and
  // gains two more phases, so it discriminates on THREE points instead of two.
  it.each([42, 20, 10])('Lyra (not one-shotting): farm ranks attack strictly above energy at maxPhase %i', (mp) => {
    const hero = heroByName('Lyra');
    const result = rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    const rows = result.rows!;
    const attack = rows.find((r) => r.stat === 'attack')!;
    const energy = rows.find((r) => r.stat === 'energy')!;
    expect(attack.gainPct).toBeGreaterThan(energy.gainPct);
    expect(rows[0].stat).toBe('attack');
  });

  it('Perrin L4 FLIPPED BACK at maxPhase 42 (issue #132) — recorded, not hidden', () => {
    // The sensor exists to prove "energy always wins" is false. Perrin flipped OUT of that claim
    // at the 2026-08-15 patch (attack 0.127926 < energy 0.142735, pinned in that PR) and flipped
    // BACK into it at the 2026-08-18 revert — attack ranks above energy again, matching his
    // pre-2026-08-15 shape. Pinned so a future change that flips him away a second time is
    // visible rather than silent.
    // RE-MEASURED for issue #132's team-aura roster shape (same Jon-uptime -> squad House
    // allocation ripple as the Bellatrix tests above) — the flip itself is unaffected.
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName('Perrin').id, maxPhase: 42 });
    const rows = result.rows!;
    expect(rows.find((r) => r.stat === 'attack')!.gainPct).toBeCloseTo(0.147681236805286, 5);
    expect(rows.find((r) => r.stat === 'energy')!.gainPct).toBeCloseTo(0.14054141113637453, 5);
    expect(rows[0].stat).toBe('attack');
  });
});

describe('rankNextPointForFarm — cdr scores SMALL BUT POSITIVE under farm (it used to be exactly 0)', () => {
  // This block previously pinned `cdr.gainPct === 0` with a note telling future readers not to
  // "fix" it. That note was correct about the OLD model and wrong about the game.
  //
  // Under `cycle = max(fuseSecs, E_D_CELLS / walkSpeed)`, the walk term dominated at every
  // fixture speed, so a shorter fuse could never change the plant rate and CDR was worth
  // literally nothing. Averaging over the measured hop distribution instead, roughly 45% of a
  // slow hero's plants land on hops short enough that `hop/w < fuse` — the fuse-bound branch,
  // observed live as a flat floor across hops 2-4. On those plants a CDR point DOES buy cadence.
  //
  // So CDR is no longer free to ignore, but it stays far below speed and energy because it only
  // pays on the short-hop mass. Asserted as a shape (positive, small, never top) rather than
  // per-hero constants: the exact values move with any re-fit of the distribution.
  it.each(['Bellatrix', 'Jon', 'Lyra', 'Perrin'])('%s: cdr gainPct >= 0 and never ranks first', (name) => {
    const hero = heroByName(name);
    const result = rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 });
    const rows = result.rows!;
    const cdr = rows.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBeGreaterThanOrEqual(0);
    expect(rows[0].stat).not.toBe('cdr');
    expect(cdr.gainPct).toBeLessThan(rows[0].gainPct);
  });

  it('at least one fixture hero now scores cdr strictly above 0 — the fuse-bound branch is reachable', () => {
    const anyPositive = ['Bellatrix', 'Jon', 'Lyra', 'Perrin'].some((name) => {
      const result = rankNextPointForFarm({ bases, account, heroId: heroByName(name).id, maxPhase: 42 });
      return result.rows!.find((r) => r.stat === 'cdr')!.gainPct > 0;
    });
    expect(anyPositive).toBe(true);
  });
});

describe('rankNextPointForFarm — design.md §4.4 edge/degenerate cases, full tuple', () => {
  const bellatrix = heroByName('Bellatrix');

  it('empty bases ⇒ emptyPool, rows/phase null, evaluations 0', () => {
    const result = rankNextPointForFarm({ bases: [], account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result).toEqual({
      outcome: 'emptyPool',
      rows: null,
      phase: null,
      objective: { kind: 'gold', weight: 1, unit: 'goldPerHour' },
      evaluations: 0,
    });
    assertResultIsFinite(result);
  });

  it('heroId not in bases ⇒ heroNotInPool, rows/phase null, evaluations 0 (a caller error, reported not thrown)', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: 'not-a-real-hero-id', maxPhase: 42 });
    expect(result).toEqual({
      outcome: 'heroNotInPool',
      rows: null,
      phase: null,
      objective: { kind: 'gold', weight: 1, unit: 'goldPerHour' },
      evaluations: 0,
    });
    assertResultIsFinite(result);
  });

  it('every basis degenerate ⇒ allDegenerate, rows/phase null, evaluations 0', () => {
    const jon = heroByName('Jon');
    const degenJon: HeroRecord = { ...jon, birth: jon.birth ? { ...jon.birth, speed: 0, attack: 0 } : jon.birth };
    const soloBases = computeHeroFarmBases({ heroes: [degenJon], account });
    const result = rankNextPointForFarm({ bases: soloBases, account, heroId: degenJon.id, maxPhase: 42 });
    expect(result).toEqual({
      outcome: 'allDegenerate',
      rows: null,
      phase: null,
      objective: { kind: 'gold', weight: 1, unit: 'goldPerHour' },
      evaluations: 0,
    });
    assertResultIsFinite(result);
  });

  it('a squad with zero field slots ⇒ noBaseline (no phase is feasible), evaluations 1 under gold', () => {
    const zeroSlots = { ...account, slots: 0 };
    const zeroSlotBases = computeHeroFarmBases({ heroes, account: zeroSlots });
    const result = rankNextPointForFarm({
      bases: zeroSlotBases,
      account: zeroSlots,
      heroId: bellatrix.id,
      objective: { kind: 'gold' },
      maxPhase: 42,
    });
    expect(result).toEqual({
      outcome: 'noBaseline',
      rows: null,
      phase: null,
      objective: { kind: 'gold', weight: 1, unit: 'goldPerHour' },
      evaluations: 1,
    });
    assertResultIsFinite(result);
  });

  it('the same noBaseline squad under a blend objective spends 2 extra evaluations on the frozen scales (3 total)', () => {
    const zeroSlots = { ...account, slots: 0 };
    const zeroSlotBases = computeHeroFarmBases({ heroes, account: zeroSlots });
    const result = rankNextPointForFarm({
      bases: zeroSlotBases,
      account: zeroSlots,
      heroId: bellatrix.id,
      objective: { kind: 'blend', weight: 0.5 },
      maxPhase: 42,
    });
    expect(result.outcome).toBe('noBaseline');
    expect(result.evaluations).toBe(3);
    assertResultIsFinite(result);
  });

  it('one degenerate hero among healthy ones still ranks normally — the degenerate hero contributes 0, not a failure', () => {
    const jon = heroByName('Jon');
    const degenJon: HeroRecord = { ...jon, birth: jon.birth ? { ...jon.birth, speed: 0, attack: 0 } : jon.birth };
    const mixedHeroes = heroes.map((h) => (h.id === jon.id ? degenJon : h));
    const mixedBases = computeHeroFarmBases({ heroes: mixedHeroes, account });
    const result = rankNextPointForFarm({ bases: mixedBases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    expect(result.rows).toHaveLength(RANK_STATS.length);
    expect(result.evaluations).toBe(8);
    assertResultIsFinite(result);
  });

  it('a pool of exactly one hero (the ranked one) still ranks — solo Bellatrix argmaxes at phase 30', () => {
    const soloBases = computeHeroFarmBases({ heroes, account, enabledHeroIds: [bellatrix.id] });
    const result = rankNextPointForFarm({ bases: soloBases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    expect(result.phase).toBe(30);
    expect(result.rows).toHaveLength(RANK_STATS.length);
    expect(result.evaluations).toBe(8);
    assertResultIsFinite(result);
  });

  it('an unknown objective.kind never throws — resolveFarmObjective clamps to gold', () => {
    const result = rankNextPointForFarm({
      bases,
      account,
      heroId: bellatrix.id,
      // @ts-expect-error — deliberately malformed, proving the total-function contract at the boundary
      objective: { kind: 'not-a-real-objective', weight: NaN },
      maxPhase: 42,
    });
    expect(result.outcome).toBe('ranked');
    expect(result.objective).toEqual({ kind: 'gold', weight: 1, unit: 'goldPerHour' });
    assertResultIsFinite(result);
  });

  it('duplicate hero ids in bases: both are counted (the squad reduction sees the hero twice) and the FIRST match is ranked', () => {
    const bellatrixBasis = bases.find((b) => b.heroId === bellatrix.id)!;
    const dupBases = [bellatrixBasis, bellatrixBasis, ...bases.filter((b) => b.heroId !== bellatrix.id)];
    const dup = rankNextPointForFarm({ bases: dupBases, account, heroId: bellatrix.id, maxPhase: 42 });
    const nonDup = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(dup.outcome).toBe('ranked');
    // Counting the hero twice changes the squad's concurrency/energy weighting, so the gain
    // figure differs from the non-duplicated pool — proving "both counted", not silently deduped.
    expect(dup.rows![0].gainPct).not.toBe(nonDup.rows![0].gainPct);
    assertResultIsFinite(dup);
  });
});

describe('rankNextPointForFarm — an unknown maxPhase considers all 600 phases', () => {
  const bellatrix = heroByName('Bellatrix');

  it.each([null, 0, -1, NaN])('maxPhase %s is treated identically to an explicit 600', (mp) => {
    const explicit600 = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 600 });
    const underTest = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: mp });
    expect(underTest.phase).toBe(explicit600.phase);
    expect(underTest.rows).toEqual(explicit600.rows);
  });

  it('a genuinely bounded maxPhase (5) differs from the unbounded result — the cap is real, not decorative', () => {
    const unbounded = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 600 });
    const bounded = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 5 });
    expect(bounded.phase).toBe(5);
    expect(bounded.phase).not.toBe(unbounded.phase);
    expect(bounded.rows![0].gainPct).not.toBe(unbounded.rows![0].gainPct);
  });
});

describe('rankNextPointForFarm — deterministic tie order', () => {
  const bellatrix = heroByName('Bellatrix');

  it('the four keys tied at 0 on Bellatrix come back in RANK_STATS relative order', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const tiedStats = result.rows!.filter((r) => r.gainPct === 0).map((r) => r.stat);
    const expectedOrder = RANK_STATS.filter((stat) => tiedStats.includes(stat));
    expect(tiedStats).toEqual(expectedOrder);
  });

  it('the tie order is unchanged when the bases array is reversed', () => {
    const forward = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const reversedBases = [...bases].reverse();
    const reversed = rankNextPointForFarm({ bases: reversedBases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(reversed.rows!.map((r) => r.stat)).toEqual(forward.rows!.map((r) => r.stat));
  });

  it('repeated calls on the same input are byte-identical (no hidden nondeterminism)', () => {
    const first = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const second = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(second.rows).toEqual(first.rows);
  });
});

describe('rankNextPointForFarm — evaluation budget', () => {
  const bellatrix = heroByName('Bellatrix');

  it('spends exactly 8 evaluations under gold/chests and never exceeds the exported constant', () => {
    const gold = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective: { kind: 'gold' }, maxPhase: 42 });
    const chests = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective: { kind: 'chests' }, maxPhase: 42 });
    expect(gold.evaluations).toBe(8);
    expect(chests.evaluations).toBe(8);
    expect(gold.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
  });

  it('spends exactly 10 evaluations under blend (the 2 extra frozen-scale sweeps)', () => {
    const blend = rankNextPointForFarm({
      bases,
      account,
      heroId: bellatrix.id,
      objective: { kind: 'blend', weight: 0.5 },
      maxPhase: 42,
    });
    expect(blend.evaluations).toBe(10);
    expect(blend.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
  });

  it('FARM_RANK_MAX_EVALUATIONS is exactly 10', () => {
    expect(FARM_RANK_MAX_EVALUATIONS).toBe(10);
  });
});

describe('rankNextPointForFarm — finite sweep over every fixture hero and every objective kind', () => {
  it.each(['Bellatrix', 'Jon', 'Lyra', 'Perrin'])('%s: never NaN, never Infinity, for gold/chests/blend', (name) => {
    const hero = heroByName(name);
    for (const objective of [{ kind: 'gold' as const }, { kind: 'chests' as const }, { kind: 'blend' as const, weight: 0.5 }]) {
      const result = rankNextPointForFarm({ bases, account, heroId: hero.id, objective, maxPhase });
      assertResultIsFinite(result);
    }
  });
});
