/**
 * Golden characterization of the DPS next-point ranking: two heroes' full rankings, pinned to
 * full precision, so any unintended change to a per-point rate or to the duty cycle surfaces as a
 * number that moved rather than as nothing at all. Values are read off a real run, never
 * hand-derived.
 *
 * RE-POINTED onto `save-20260819-11882-7heroes.json` (issue #206). The retired
 * `save-20260813-5heroes.json` had left its regime, and the two subjects pinned on it were
 * disabled rather than re-recorded — a golden pinned to a capture the model can no longer solve
 * is not a canary, it is a number nobody can act on. Its re-recording history (the House cycle
 * correction, the 2026-08-18 crit/CDR revert, the 2026-08-23 ability shape) described that
 * roster and is kept in `docs/fixture-corpus.md` rather than carried onto this one.
 *
 * WHAT A GOLDEN CAN AND CANNOT SAY, restated because it is easy to lose: these figures are this
 * model's own output, so they are not evidence about the game and re-recording them proves
 * nothing on its own. What they buy is a diff. When one of them moves, the change was reached by
 * something, and the useful work is naming what — which is why every past re-record here is
 * accompanied by a footprint (which stats moved, on which subjects, and by how much) rather than
 * just a new number.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { rankNextPoint, STAT_CAPS, POINT_GAIN, type HeroSheet, type Context, type PointValue } from '@bombfarm/domain/model';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
// One registry, read across the package boundary by relative path — the same way this tree's
// own sheet-math helper reads the domain package's committed captures rather than copying them.
import { holdSuiteUntilInRegime } from '../../../../packages/domain/tests/helpers/capture-regime';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURE = 'save-20260819-11882-7heroes.json';

// A golden is our own output by construction, so it can never be a claim about the game —
// its whole value is catching an unintended model change as a number that moved. That value
// is real only while the capture underneath it is one the model can still solve, which is why
// this is re-pointed rather than re-recorded in place (issue #206).
holdSuiteUntilInRegime(`sheet-math/${FIXTURE}`, 'sheet');

const pick = (rows: readonly PointValue[]) => rows.map((r) => ({ stat: r.stat, gainPct: r.gainPct }));

describe('DPS next-point ranking — golden fixture (pre-deletion, pinned byte-for-byte)', () => {
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
   * Gale L48, geared, is the discriminating subject: he is the ONLY hero on this roster whose
   * energy point outranks his attack point, and the margin is thin (1.7311 vs 1.7126, ~1.1%).
   * A change that shifted either rate even slightly would reorder him while leaving the other six
   * heroes' orders intact — which is exactly what a golden is for.
   */
  it('Gale L48 (geared) — full ranking pinned to full precision, energy first', () => {
    const result = pipelineForHero(heroByName('Gale'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'energy', gainPct: 1.7311496794442327 },
      { stat: 'attack', gainPct: 1.7125841501893335 },
      { stat: 'critDmg', gainPct: 0.4459730294051445 },
      { stat: 'critChance', gainPct: 0.09916082858885122 },
      { stat: 'cdr', gainPct: 0.04603364218642714 },
      { stat: 'penetration', gainPct: 0.0019944659124915276 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  /**
   * Kael L2, naked, is the opposite end: nothing equipped, two points spent, and attack ahead of
   * energy by more than 2x. Pinning both ends means a change that only reaches geared heroes, or
   * only reaches the level term, shows up on exactly one of the two.
   */
  it('Kael L2 (naked) — full ranking pinned to full precision, attack dominant', () => {
    const result = pipelineForHero(heroByName('Kael'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 15.948186475064418 },
      { stat: 'energy', gainPct: 7.106169237061066 },
      { stat: 'critDmg', gainPct: 0.21177885060466028 },
      { stat: 'critChance', gainPct: 0.038417584566374785 },
      { stat: 'cdr', gainPct: 0.030742187784227326 },
      { stat: 'penetration', gainPct: 0.00040830708942785066 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });
});

describe('DPS next-point ranking — CDR marginal-fuse special case (golden, pre-deletion)', () => {
  const baseCtx = (): Context => ({
    restSeconds: 12 * 60,
    mitigation: 0.067,
    blastRange: 1,
    cycleModel: 'serial',
    walkDelay: 0.15,
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
    expect(cdr.gainPct).toBe(0.05130836326321386);
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
      { stat: 'attack', gainPct: 2.499999999999991 },
      { stat: 'energy', gainPct: 0.9381107491856833 },
      { stat: 'critDmg', gainPct: 0.5474452554744547 },
      { stat: 'critChance', gainPct: 0.10218978102187748 },
      { stat: 'cdr', gainPct: 0.05130836326321386 },
      { stat: 'penetration', gainPct: 0.003570058399771092 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });
});
