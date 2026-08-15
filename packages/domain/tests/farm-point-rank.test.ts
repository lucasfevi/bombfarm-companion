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

  it.each([42, 5, 1])('at maxPhase %i: farm scores attack exactly 0 while energy and speed are positive', (mp) => {
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

  it('farm ranks speed first and energy second at maxPhase 42, pinned to full precision (recorded from a real run)', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const rows = result.rows!;
    expect(rows[0]).toEqual({ stat: 'speed', label: 'Velocidade', gainPct: 1.0929227121592167 });
    expect(rows[1]).toEqual({ stat: 'energy', label: 'Energia', gainPct: 0.8508793573207329 });
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
  it.each(['Lyra', 'Perrin'])('%s (not one-shotting): farm ranks attack strictly above energy at maxPhase 42', (name) => {
    const hero = heroByName(name);
    const result = rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    const rows = result.rows!;
    const attack = rows.find((r) => r.stat === 'attack')!;
    const energy = rows.find((r) => r.stat === 'energy')!;
    expect(attack.gainPct).toBeGreaterThan(energy.gainPct);
    expect(rows[0].stat).toBe('attack');
  });
});

describe('rankNextPointForFarm — cdr scores exactly 0 under farm for every fixture hero', () => {
  // Not a bug: the farm cadence is cycle = max(fuseSecs, E_D_CELLS / walkSpeed), and the walk
  // term dominates for every fixture hero, so shortening the fuse (what a CDR point buys)
  // changes nothing about plant rate. This is the reason `speed` — worth 0 for DPS — is worth
  // the most for farming. Pinned so a future reader does not "fix" it.
  it.each(['Bellatrix', 'Jon', 'Lyra', 'Perrin'])('%s: cdr gainPct === 0', (name) => {
    const hero = heroByName(name);
    const result = rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 });
    const cdr = result.rows!.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBe(0);
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
