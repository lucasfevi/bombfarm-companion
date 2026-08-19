/**
 * Golden characterization of today's DPS next-point ranking, recorded from the tree BEFORE the
 * one-shot heuristic is deleted. The deletion that follows must reproduce these figures
 * byte-for-byte — this file is the proof, not a claim. Values were read off a real run of the
 * current (pre-deletion) code, not hand-derived.
 *
 * RE-RECORDED for the 2026-08-18 crit-chance/CDR revert (issue #132). Diffed value by value
 * against the previous golden first; the footprint is:
 *
 * - **`critChance` and `cdr` on every subject**, moving in both directions and RE-ORDERING —
 *   under the flat model `cdr` outranked `critChance` on all four subjects; under the reverted
 *   percent-of-base model `critChance` now outranks `cdr` on all four. A pooled stat's marginal
 *   value scales with the hero's own roll again, so a hero with a well-rolled crit chance and a
 *   thin cooldown roll gets more from a crit-chance point than a flat rate ever gave it.
 * - **`critDmg` moved too, on every subject**, purely as a SECOND-ORDER effect: `critFactor`
 *   couples crit chance and crit damage (`avgHit = base × (1 + critChance/100 × (critDmg/100 −
 *   1))`), so a hero's crit-damage marginal value shifts whenever her crit-chance baseline does,
 *   even though crit damage's own per-point rate (flat, `POINT_GAIN.critDmgFlat`) never changed.
 * - `attack` / `energy` / `penetration` moved in the 12th–13th significant digit only on some
 *   subjects (IEEE-754 re-association off the changed crit-chance/cdr baseline feeding the same
 *   shared computation) — not on every subject, and never enough to change rank order. `speed`
 *   is byte-identical (0) on every subject, as it always is once it hits its own ranking floor.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { rankNextPoint, STAT_CAPS, POINT_GAIN, type HeroSheet, type Context, type PointValue } from '@bombfarm/domain/model';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURE = 'save-20260813-5heroes.json';

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

  it('Bellatrix L42 — full ranking pinned to full precision', () => {
    const result = pipelineForHero(heroByName('Bellatrix'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 2.124613721702273 },
      { stat: 'energy', gainPct: 1.3870977028320741 },
      { stat: 'critDmg', gainPct: 0.45173381134235857 },
      { stat: 'critChance', gainPct: 0.07215154969466564 },
      { stat: 'cdr', gainPct: 0.03270868386004988 },
      { stat: 'penetration', gainPct: 0.0018927950044211883 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Jon L38 — full ranking pinned to full precision', () => {
    const result = pipelineForHero(heroByName('Jon'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 2.7210974575787805 },
      { stat: 'energy', gainPct: 2.3198024157065955 },
      { stat: 'critDmg', gainPct: 0.3844374051138466 },
      { stat: 'critChance', gainPct: 0.06045133145871073 },
      { stat: 'cdr', gainPct: 0.01848900890673022 },
      { stat: 'penetration', gainPct: 0.0008367710926826533 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Lyra L2 — full ranking pinned to full precision', () => {
    const result = pipelineForHero(heroByName('Lyra'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 14.754149056578392 },
      { stat: 'energy', gainPct: 6.080634761133874 },
      { stat: 'critDmg', gainPct: 0.30733791355714857 },
      { stat: 'critChance', gainPct: 0.05162744444042744 },
      { stat: 'cdr', gainPct: 0.03458638173732265 },
      { stat: 'penetration', gainPct: 0.0008296399027774015 },
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
