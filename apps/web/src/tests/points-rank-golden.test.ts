/**
 * Golden characterization of the DPS next-point ranking: two heroes' full rankings, pinned to
 * full precision, so any unintended change to a per-point rate or to the duty cycle surfaces as a
 * number that moved rather than as nothing at all. Values are read off a real run, never
 * hand-derived.
 *
 * WHAT A GOLDEN CAN AND CANNOT SAY, restated because it is easy to lose: these figures are this
 * model's own output, so they are not evidence about the game and re-recording them proves
 * nothing on its own. What they buy is a diff. When one of them moves, the change was reached by
 * something, and the useful work is naming what — which is why every re-record here is
 * accompanied by a footprint (which stats moved, on which subjects, and by how much) rather than
 * just a new number. A golden pinned to a capture the model can no longer solve is not a canary,
 * it is a number nobody can act on, so an expired capture is re-pointed rather than re-recorded
 * in place; the earlier rosters' re-recording history is kept in `docs/fixture-corpus.md`.
 *
 * Re-pointed onto `save-20260914-9heroes-second-account.json` — the same account as the retired
 * 2026-08-19 capture, 26 days on — with new subjects, so the two roster figures are not
 * comparable to the old ones. The roster-independent synthetic-hero figures below reproduced
 * exactly across the re-point, which is the one comparison the swap allows.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { rankNextPoint, STAT_CAPS, POINT_GAIN, type HeroSheet, type Context, type PointValue } from '@bombfarm/domain/model';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { holdSuiteUntilInRegime } from '../../../../packages/domain/tests/helpers/capture-regime';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURE = 'save-20260914-9heroes-second-account.json';

holdSuiteUntilInRegime(`sheet-math/${FIXTURE}`, 'sheet');

const pick = (rows: readonly PointValue[]) => rows.map((r) => ({ stat: r.stat, gainPct: r.gainPct }));

describe('DPS next-point ranking — golden fixture (pinned byte-for-byte)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const parsed = parseAccountPayload(raw, []);
  if (parsed.rejected) throw new Error(`fixture rejected: ${parsed.rejected.reason}`);

  const accountData = parsed.account;
  if (!accountData.tree) throw new Error('fixture must carry a skill tree');
  const tree = accountData.tree;
  const phase = accountData.phase;
  if (phase == null) throw new Error('fixture must carry account.phase');
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');
  const mitigationPct = line.mitig * 100;

  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
    },
    teamBuffs: zeroTeamBuffs(),
    context: {
      houseIdx: accountData.houseIdx ?? 0,
      houseLevel: accountData.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    slots: accountData.slots ?? undefined,
  };

  function heroByName(name: string): HeroRecord {
    const candidate = parsed.candidates.find((c) => c.record.name === name);
    if (!candidate) throw new Error(`fixture hero "${name}" not found`);
    return { ...candidate.record, id: candidate.sourceId, updatedAt: 0 };
  }

  /**
   * Devin L87, geared 8/8 with Olho Clínico 20/20, is the discriminating subject: he is the ONLY
   * hero on this roster whose top point is not attack — his crit-damage point outranks it
   * (1.6258 vs 1.0901), because the ability's flat +40 crit chance makes every crit-damage point
   * pay on nearly half his bombs. A change that shifted either rate would reorder him while
   * leaving the other eight heroes' attack-first orders intact — which is exactly what a golden
   * is for.
   */
  it('Devin L87 (geared, Olho Clínico) — full ranking pinned to full precision, crit damage first', () => {
    const result = pipelineForHero(heroByName('Devin'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'critDmg', gainPct: 1.6258384769856304 },
      { stat: 'attack', gainPct: 1.0900754392397571 },
      { stat: 'speed', gainPct: 0.4586162938889915 },
      { stat: 'energy', gainPct: 0.3079450009872753 },
      { stat: 'critChance', gainPct: 0.08676728467884587 },
      { stat: 'cdr', gainPct: 0.01750429994018532 },
      { stat: 'penetration', gainPct: 0.00244876856141385 },
    ]);
  });

  /**
   * Isolde L67, naked with all 67 points unspent, is the opposite end: nothing equipped, nothing
   * spent, and attack ahead of energy by more than 2x on a sheet that is birth roll, tree and
   * ability terms alone. Pinning both ends means a change that only reaches geared heroes, or
   * only reaches the level term, shows up on exactly one of the two.
   */
  it('Isolde L67 (naked, no points spent) — full ranking pinned to full precision, attack dominant', () => {
    const result = pipelineForHero(heroByName('Isolde'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 5.04711144179415 },
      { stat: 'energy', gainPct: 2.305569985939271 },
      { stat: 'speed', gainPct: 0.7083292471643077 },
      { stat: 'critDmg', gainPct: 0.23330731000408278 },
      { stat: 'critChance', gainPct: 0.08375991220037626 },
      { stat: 'cdr', gainPct: 0.01524226244737914 },
      { stat: 'penetration', gainPct: 0.0012742229402507022 },
    ]);
  });
});

describe('DPS next-point ranking — CDR marginal-fuse special case (golden, roster-independent)', () => {
  const baseCtx = (): Context => ({
    restSeconds: 12 * 60,
    mitigation: 0.067,
    blastRange: 1,
    ato: 1,
    drainMult: 1,
  });

  const sampleHero = (): HeroSheet => ({
    rarity: 'Raro',
    attack: 400,
    energy: 500,
    speed: 55,
    critChance: 12,
    critDmg: 80,
    penetration: 8,
    cdr: 10,
    attackPerPoint: POINT_GAIN.attackNative,
    energyPerPoint: POINT_GAIN.energyNative,
  });

  it('cdr below the 80% cap: positive gain, pinned to full precision', () => {
    const ranking = rankNextPoint(sampleHero(), baseCtx());
    const cdr = ranking.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBeGreaterThan(0);
    expect(cdr.gainPct).toBe(0.013615513971942939);
  });

  it('cdr at the 80% cap: exactly zero gain, pinned to full precision', () => {
    const ranking = rankNextPoint({ ...sampleHero(), cdr: STAT_CAPS.cdr }, baseCtx());
    const cdr = ranking.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBe(0);
  });

  it('no options object and a bare {} both keep working and agree exactly (isRankOptions narrowing)', () => {
    const withNoOptions = rankNextPoint(sampleHero(), baseCtx());
    const withBareObject = rankNextPoint(sampleHero(), baseCtx(), {});
    expect(pick(withBareObject)).toEqual(pick(withNoOptions));
    expect(pick(withNoOptions)).toEqual([
      { stat: 'attack', gainPct: 2.499999999999969 },
      { stat: 'speed', gainPct: 1.07671627058179 },
      { stat: 'energy', gainPct: 0.9381107491856611 },
      { stat: 'critDmg', gainPct: 0.5474452554744547 },
      { stat: 'critChance', gainPct: 0.10218978102187748 },
      { stat: 'cdr', gainPct: 0.013615513971942939 },
      { stat: 'penetration', gainPct: 0.0035700583997488877 },
    ]);
  });
});
