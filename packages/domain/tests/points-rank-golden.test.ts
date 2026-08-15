/**
 * Golden characterization of today's DPS next-point ranking, recorded from the tree BEFORE the
 * one-shot heuristic is deleted. The deletion that follows must reproduce these figures
 * byte-for-byte — this file is the proof, not a claim. Values were read off a real run of the
 * current (pre-deletion) code, not hand-derived.
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
      { stat: 'attack', gainPct: 2.11245829411546 },
      { stat: 'energy', gainPct: 1.5502551329830583 },
      { stat: 'critDmg', gainPct: 0.38951772890567504 },
      { stat: 'cdr', gainPct: 0.16369137865093197 },
      { stat: 'critChance', gainPct: 0.07368910876905943 },
      { stat: 'penetration', gainPct: 0.0018932967115414812 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Jon L38 — full ranking pinned to full precision', () => {
    const result = pipelineForHero(heroByName('Jon'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 2.721097457578736 },
      { stat: 'energy', gainPct: 2.400539150524539 },
      { stat: 'critDmg', gainPct: 0.27489791609069947 },
      { stat: 'cdr', gainPct: 0.09250544693830687 },
      { stat: 'critChance', gainPct: 0.060468764102172834 },
      { stat: 'penetration', gainPct: 0.0008369005070285596 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Lyra L2 — full ranking pinned to full precision', () => {
    const result = pipelineForHero(heroByName('Lyra'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 14.754149056578392 },
      { stat: 'energy', gainPct: 6.080634761133874 },
      { stat: 'critDmg', gainPct: 0.21733619405484017 },
      { stat: 'cdr', gainPct: 0.17317148368838353 },
      { stat: 'critChance', gainPct: 0.0517218574636269 },
      { stat: 'penetration', gainPct: 0.0008296399027551971 },
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
    expect(cdr.gainPct).toBe(0.25706940874035134);
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
      { stat: 'critDmg', gainPct: 0.5693430656934284 },
      { stat: 'cdr', gainPct: 0.25706940874035134 },
      { stat: 'critChance', gainPct: 0.10218978102187748 },
      { stat: 'penetration', gainPct: 0.003570058399771092 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });
});
