/**
 * The farm-mode next-point scorer. Every case here is measured on
 * `save-20260914-20heroes-phase101.json` (pool = all 20 heroes, gold objective, return bonus off,
 * `maxPhase 42` unless stated) — figures are recorded from a real run, not hand-derived.
 *
 * The roster holds both sides of the one-shot contrast at once: thirteen geared heroes at
 * L40–L151 that one-shot a phase-42 prop and seven naked ones at L1–L24 that do not. Two things
 * about the set-up are deliberate. The seven are `battle_allowed: false` on the capture, so the
 * pool is passed explicitly as every id rather than taken from the default (which would drop
 * them and leave nothing on the far side of the contrast). And the phase is 42 rather than the
 * account's own 101: at 101 none of the thirteen one-shots any more (hits-to-kill 1.03–6.6), so
 * the contrast the file is named for exists only below the account's frontier.
 *
 * A pool of 20 over 9 field slots is also a saturated field, which shows in the numbers: the
 * uptime an energy point buys is rationed by the FIFO queue, so energy ranks low on most geared
 * heroes and goes negative on the weak ones. The 11-hero 2026-08-25 roster this file was
 * measured on before ranked energy first on eight of nine one-shotters; that claim is a property
 * of a pool the field can seat, not of the scorer, and it is recorded here as what this roster
 * measures instead.
 */
import { describe, expect, it } from 'vitest';
import {
  rankNextPointForFarm,
  computeHeroFarmBases,
  FARM_RANK_MAX_EVALUATIONS,
  type FarmPointRankResult,
} from '@bombfarm/domain/farm-point-rank';
import { computeHeroFarmFacts, computeSquadFarmFacts, computeFarmRateRow } from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { RANK_STATS } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';
import { FARM_POINT_RANK_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

// Module scope, and throwing rather than skipping: every test below reads a number off this one
// capture, so there is no per-test judgement to make and nothing to skip into. If the fixture is
// ever swapped for one behind a boundary, this file fails loudly instead of asserting a stale
// number — which is the failure mode `helpers/capture-regime.ts` exists to close.
holdSuiteUntilInRegime(`sheet-math/${FARM_POINT_RANK_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_POINT_RANK_FIXTURE);
const POOL_IDS = heroes.map((hero) => hero.id);
const bases = computeHeroFarmBases({ heroes, account, enabledHeroIds: POOL_IDS });

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

function gainOf(result: FarmPointRankResult, stat: string): number {
  return result.rows!.find((row) => row.stat === stat)!.gainPct;
}

/** Whether `hero`, farming alone, clears every phase-42 prop in one hit. */
function oneShotsPhase42(hero: HeroRecord): boolean {
  const facts = computeHeroFarmFacts({ heroes, account, enabledHeroIds: [hero.id] });
  return computeFarmRateRow(42, computeSquadFarmFacts(facts, account))!.oneShot;
}

/** The thirteen geared heroes — exactly the capture's `battle_allowed` half. Two are named Torin. */
const ONE_SHOTTERS = heroes.filter((hero) => hero.battleAllowed !== false);
/** The seven naked ones, L1–L24, all benched on the capture. */
const NON_ONE_SHOTTERS = heroes.filter((hero) => hero.battleAllowed === false);
/**
 * Naked and NOT one-shotting (hits-to-kill 1.77–11.2 at phase 42), yet the next attack point
 * scores exactly 0 on two of them: the gold objective is a step function in damage, and a single
 * point does not carry BP 03 or BP 05 across a hits-to-kill step. The other five do cross one.
 */
const NAKED_ATTACK_POSITIVE = ['BP 01', 'BP 02', 'BP 04', 'Bram', 'Gale'];
const NAKED_ATTACK_ON_A_STEP = ['BP 03', 'BP 05'];

describe('the roster holds both sides of the one-shot contrast at phase 42', () => {
  it('thirteen geared heroes one-shot a phase-42 prop on their own; the seven naked ones do not', () => {
    expect(ONE_SHOTTERS).toHaveLength(13);
    expect(NON_ONE_SHOTTERS).toHaveLength(7);
    for (const hero of ONE_SHOTTERS) expect(oneShotsPhase42(hero), `${hero.name} L${hero.level}`).toBe(true);
    for (const hero of NON_ONE_SHOTTERS) expect(oneShotsPhase42(hero), `${hero.name} L${hero.level}`).toBe(false);
  });
});

describe('rankNextPointForFarm — discrimination: a one-shotting squad inverts the two ranking modes', () => {
  const bellatrix = heroByName('Bellatrix');

  it.each([42, 20, 5, 1])('at maxPhase %i: farm scores attack exactly 0 while energy and speed are positive', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    expect(gainOf(result, 'attack')).toBe(0);
    expect(gainOf(result, 'energy')).toBeGreaterThan(0);
    expect(gainOf(result, 'speed')).toBeGreaterThan(0);
    assertResultIsFinite(result);
  });

  it.each([42, 5, 1])('at maxPhase %i: Jon still one-shots — attack exactly 0, energy and speed positive', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName('Jon').id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    expect(gainOf(result, 'attack')).toBe(0);
    expect(gainOf(result, 'energy')).toBeGreaterThan(0);
    expect(gainOf(result, 'speed')).toBeGreaterThan(0);
    assertResultIsFinite(result);
  });

  /**
   * THE OTHER HALF OF THE CONTRAST. An attack point scoring 0 only means "this hero already
   * one-shots" if some hero on the same roster, at the same phase, scores it above 0 — otherwise
   * a regression that zeroed attack unconditionally would read as a squad of one-shotters and
   * pass. These five are that control.
   */
  it.each(NAKED_ATTACK_POSITIVE)('%s does NOT one-shot at maxPhase 42 — an attack point scores strictly above 0', (name) => {
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName(name).id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    expect(gainOf(result, 'attack')).toBeGreaterThan(0);
    assertResultIsFinite(result);
  });

  it('both sides are populated at maxPhase 42 — the thirteen one-shotters plus the two naked heroes sitting on a hits-to-kill step score exactly 0, five naked heroes strictly above it', () => {
    const gains = new Map(
      heroes.map((hero) => [hero.id, gainOf(rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 }), 'attack')]),
    );
    const nameOf = (id: string) => heroes.find((hero) => hero.id === id)!.name;
    const zero = [...gains].filter(([, gain]) => gain === 0).map(([id]) => nameOf(id)).sort();
    const positive = [...gains].filter(([, gain]) => gain > 0).map(([id]) => nameOf(id)).sort();
    expect(zero).toEqual([...ONE_SHOTTERS.map((hero) => hero.name), ...NAKED_ATTACK_ON_A_STEP].sort());
    expect(positive).toEqual([...NAKED_ATTACK_POSITIVE].sort());
    for (const name of NAKED_ATTACK_ON_A_STEP) expect(oneShotsPhase42(heroByName(name))).toBe(false);
  });

  it('farm ranks SPEED first for every one-shotter at maxPhase 42, energy for none — the field is saturated, so cadence beats uptime', () => {
    // Speed shortens every walk-bound plant a hero makes while she holds a field slot; energy
    // buys more field seconds, but with twenty heroes queued for nine slots those seconds are
    // rationed by the queue rather than added to the squad. Bellatrix's full order is pinned as
    // the recorded shape: cdr a close second (the fuse-bound plants speed cannot help are the
    // ones CDR can), energy a distant third, and the four damage-side keys tied at 0.
    const rows = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 }).rows!;
    expect(rows.map((r) => r.stat)).toEqual(['speed', 'cdr', 'energy', 'attack', 'critDmg', 'critChance', 'penetration']);
    const firstStatById = new Map(
      ONE_SHOTTERS.map((hero) => [hero.id, rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 }).rows![0].stat] as const),
    );
    expect([...firstStatById.values()].every((stat) => stat === 'speed')).toBe(true);
  });

  it('DPS mode scores attack first on a hero farm scores attack at 0 (the inversion)', () => {
    // The speed half of this inversion is gone: DPS mode prices speed on every hero of every
    // roster now (0.145% on Jon here), so "speed exactly 0 under DPS" is not a claim any capture
    // can make. What survives is the attack half, which is the one that discriminates the modes.
    const jon = heroByName('Jon');
    expect(gainOf(rankNextPointForFarm({ bases, account, heroId: jon.id, maxPhase: 42 }), 'attack')).toBe(0);

    const line = account.context;
    if (line.phase == null) throw new Error('fixture must carry account.context.phase for this test');
    const dps = pipelineForHero(jon, account, line.phase, line.mitigationPct);
    expect(dps.ranking[0].stat).toBe('attack');
    expect(dps.ranking[0].gainPct).toBeGreaterThan(0);
  });
});

describe('rankNextPointForFarm — anti-"energy always wins" sensor', () => {
  /**
   * The sensor exists to prove "energy always wins" is false. Bram L1 — naked, one level, far
   * enough from one-shotting that another point of damage is still the best thing he can be
   * given — holds it on three phases, as Hale L2 did on the 2026-08-25 roster.
   */
  it.each([42, 20, 10])('Bram (not one-shotting): farm ranks attack strictly above energy at maxPhase %i', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName('Bram').id, maxPhase: mp });
    expect(result.outcome).toBe('ranked');
    expect(gainOf(result, 'attack')).toBeGreaterThan(gainOf(result, 'energy'));
    expect(result.rows![0].stat).toBe('attack');
  });

  /**
   * An energy point on the weakest hero in a queued field is worth LESS THAN NOTHING, and that is
   * a claim about the FIFO field queue rather than about Bram. Energy buys field uptime; the
   * queue rations uptime; so stacking it on the hero who clears slowest keeps him holding a slot
   * that a faster hero would have converted into more gold. Nothing else in the suite pins a
   * negative marginal value, and it is the one direction a naive "more stat is more output"
   * model can never produce — so it is asserted here rather than left as an observation.
   */
  it('Bram at maxPhase 42: an energy point is NEGATIVE — the field queue can make uptime cost the squad', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName('Bram').id, maxPhase: 42 });
    expect(gainOf(result, 'energy')).toBeLessThan(0);
    expect(gainOf(result, 'energy')).toBeCloseTo(-0.12713347066902747, 9);
    // Not a collapse: the sign is decided hero by hero. On this saturated field it is negative
    // on most of the roster, and positive on exactly the four fastest clearers.
    const positiveEnergy = heroes
      .filter((hero) => gainOf(rankNextPointForFarm({ bases, account, heroId: hero.id, maxPhase: 42 }), 'energy') > 0)
      .map((hero) => hero.name)
      .sort();
    expect(positiveEnergy).toEqual(['Bellatrix', 'Jon', 'Minato', 'NotJ']);
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
  it.each(['Bellatrix', 'Jon', 'Bram', 'Gale'])('%s: cdr gainPct >= 0 and never ranks first', (name) => {
    const result = rankNextPointForFarm({ bases, account, heroId: heroByName(name).id, maxPhase: 42 });
    const cdr = gainOf(result, 'cdr');
    expect(cdr).toBeGreaterThanOrEqual(0);
    expect(result.rows![0].stat).not.toBe('cdr');
    expect(cdr).toBeLessThan(result.rows![0].gainPct);
  });

  it('at least one fixture hero now scores cdr strictly above 0 — the fuse-bound branch is reachable', () => {
    const anyPositive = ['Bellatrix', 'Jon', 'Bram', 'Gale'].some(
      (name) => gainOf(rankNextPointForFarm({ bases, account, heroId: heroByName(name).id, maxPhase: 42 }), 'cdr') > 0,
    );
    expect(anyPositive).toBe(true);
  });
});

describe('rankNextPointForFarm — edge/degenerate cases, full tuple', () => {
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
    const zeroSlotBases = computeHeroFarmBases({ heroes, account: zeroSlots, enabledHeroIds: POOL_IDS });
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
    const zeroSlotBases = computeHeroFarmBases({ heroes, account: zeroSlots, enabledHeroIds: POOL_IDS });
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
    const mixedBases = computeHeroFarmBases({ heroes: mixedHeroes, account, enabledHeroIds: POOL_IDS });
    const result = rankNextPointForFarm({ bases: mixedBases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    expect(result.rows).toHaveLength(RANK_STATS.length);
    expect(result.evaluations).toBe(8);
    assertResultIsFinite(result);
  });

  it('a pool of exactly one hero (the ranked one) still ranks', () => {
    const soloBases = computeHeroFarmBases({ heroes, account, enabledHeroIds: [bellatrix.id] });
    const result = rankNextPointForFarm({ bases: soloBases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    // Solo, she is no longer competing for field slots, so the gold argmax walks up to the cap.
    expect(result.phase).toBe(42);
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

  it('the keys tied at 0 on Bellatrix come back in RANK_STATS relative order', () => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    const tiedStats = result.rows!.filter((r) => r.gainPct === 0).map((r) => r.stat);
    expect(tiedStats.length, 'no ties to order — this guard needs a hero with some').toBeGreaterThan(1);
    expect(tiedStats).toEqual(RANK_STATS.filter((stat) => tiedStats.includes(stat)));
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

describe('rankNextPointForFarm — finite sweep over every fixture hero and every objective kind, up to the account cap', () => {
  it.each(heroes.map((hero) => [`${hero.name} L${hero.level}`, hero.id]))('%s: never NaN, never Infinity, for gold/chests/blend', (_label, heroId) => {
    for (const objective of [{ kind: 'gold' as const }, { kind: 'chests' as const }, { kind: 'blend' as const, weight: 0.5 }]) {
      assertResultIsFinite(rankNextPointForFarm({ bases, account, heroId, objective, maxPhase }));
    }
  });
});
