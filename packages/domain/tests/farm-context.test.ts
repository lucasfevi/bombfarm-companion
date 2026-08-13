import { describe, expect, it } from 'vitest';
import {
  effectiveFarmPhase,
  effectiveMitigationPct,
  effectiveTargetProp,
  farmContextForHero,
  FARM_CYCLE_MODEL,
  FARM_WALK_DELAY_SEC,
  isTargetPropUnset,
} from '@bombfarm/domain/farm-context';
import { abilityMods } from '@bombfarm/domain/model';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import {
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';
import {
  formatPhaseLabel,
  firstPhaseForAto,
  listMapsForAto,
  phaseForMapCoord,
  phaseMapCoord,
  phaseMapDisplayName,
  phaseSubIndex,
} from '@bombfarm/domain/phase-wiki';

describe('farm-context', () => {
  it('defaults farm phase to 1 when unset', () => {
    expect(effectiveFarmPhase(null)).toBe(1);
    expect(effectiveFarmPhase(0)).toBe(1);
    expect(effectiveFarmPhase(42)).toBe(42);
  });

  it('uses phase 1 mitigation when farm phase unset', () => {
    const mit = effectiveMitigationPct({ phase: null, mitigationPct: 99 });
    expect(mit).toBeCloseTo(1, 5);
  });

  it('exposes fixed cycle constants', () => {
    expect(FARM_CYCLE_MODEL).toBe('serial');
    expect(FARM_WALK_DELAY_SEC).toBe(0.15);
  });

  it('detects unset target prop', () => {
    expect(isTargetPropUnset(null)).toBe(true);
    expect(isTargetPropUnset('')).toBe(true);
    expect(isTargetPropUnset('stone')).toBe(false);
    expect(effectiveTargetProp(null)).toBe('stone');
  });
});

describe('farmContextForHero', () => {
  it('matches computeAdvisorPipeline context for a fixture hero (AD-RGO-27)', () => {
    // MP5 F1 (AD-068 class (b) — structural: the claim is that two independently-computed
    // contexts for the same hero agree, not any particular numeric value): re-pointed onto
    // the post-patch export's geared hero, Bellatrix L42 (8/8).
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
    const tree = treeTotalsFromSave(totals);
    const mods = abilityMods(hero.abilities);
    const pipeline = computeAdvisorPipeline({
      naked: hero.sheet,
      geared: hero.sheet,
      loadout: hero.loadout,
      altLoadout: null,
      pts: {},
      statPointsAvailable: 0,
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: tree.danoStatic,
      treeCritChance: tree.critChancePct,
      treeCritDmg: tree.critDmgPct,
      treeSpeed: tree.speedPct,
      treeEnergy: tree.energyPct,
      treeGlassCannon: false,
      treeTempoDobrado: false,
      treeLuckFlatPct: tree.luckFlatPct,
      teamBuffs: zeroTeamBuffs(),
      houseIdx: 0,
      houseLevel: 1,
      phase: 1,
      mitigationPct: 6.7,
      rankMode: 'dps',
      targetProp: PROPS[1]?.name ?? PROPS[0].name,
      birth: hero.birth,
    });
    expect(pipeline.context).toEqual(
      farmContextForHero({
        mods,
        teamDrainMult: 1,
        houseIdx: 0,
        houseLevel: 1,
        mitigationPct: 6.7,
        phase: 1,
      }),
    );
  });

  it('drainMult with no drain abilities', () => {
    const mods = abilityMods({});
    const ctx = farmContextForHero({
      mods,
      teamDrainMult: 1,
      houseIdx: 0,
      houseLevel: 1,
      mitigationPct: 6.7,
      phase: 1,
    });
    expect(ctx.drainMult).toBe(1);
  });

  it('drainMult with own bateria_extra', () => {
    const mods = abilityMods({ bateria_extra: 10 });
    const ctx = farmContextForHero({
      mods,
      teamDrainMult: 1,
      houseIdx: 0,
      houseLevel: 1,
      mitigationPct: 6.7,
      phase: 1,
    });
    expect(ctx.drainMult).toBe(mods.drainMult);
    expect(ctx.drainMult).toBeLessThan(1);
  });

  it('drainMult with team folego_mineiro', () => {
    const mods = abilityMods({});
    const ctx = farmContextForHero({
      mods,
      teamDrainMult: 0.8,
      houseIdx: 0,
      houseLevel: 1,
      mitigationPct: 6.7,
      phase: 1,
    });
    expect(ctx.drainMult).toBe(0.8);
  });

  // AD-068 class (b): re-pointed, not deleted — bateria_extra and folego_mineiro are the two
  // surviving drain arms this case's real content is about; the drain ×2 arm the case's old
  // name referenced no longer participates (its whole subject is the deleted arm).
  it('drainMult with bateria_extra and folego_mineiro combined', () => {
    const mods = abilityMods({ bateria_extra: 10 });
    const ctx = farmContextForHero({
      mods,
      teamDrainMult: 0.75,
      houseIdx: 0,
      houseLevel: 1,
      mitigationPct: 6.7,
      phase: 1,
    });
    expect(ctx.drainMult).toBe(mods.drainMult * 0.75);
  });
});

describe('formatPhaseLabel', () => {
  it('formats in-game coordinates EN', () => {
    expect(formatPhaseLabel(65, 'en')).toBe('Normal 1-15 (65)');
    expect(formatPhaseLabel(151, 'en')).toBe('Hard 1-1 (151)');
  });
});

describe('phaseSubIndex', () => {
  it('phaseSubIndex matches mundo band index', () => {
    expect(phaseSubIndex(65)).toBe(15);
    expect(phaseSubIndex(151)).toBe(1);
  });
});

describe('phase map picker', () => {
  it('lists maps for a difficulty in phase order', () => {
    const easy = listMapsForAto(1);
    expect(easy[0]).toMatchObject({ phase: 1, coord: '1-1' });
    expect(easy.find((row) => row.phase === 11)).toMatchObject({ coord: '2-1' });
  });

  it('resolves phase from difficulty + map coordinate', () => {
    expect(phaseForMapCoord(1, 2, 1)).toBe(11);
    expect(phaseForMapCoord(3, 1, 1)).toBe(151);
  });

  it('reads map coordinate from phase number', () => {
    expect(phaseMapCoord(11)).toEqual({ ato: 1, mundo: 2, subIndex: 1 });
    expect(phaseMapCoord(151)).toEqual({ ato: 3, mundo: 1, subIndex: 1 });
  });

  it('defaults to first map when switching difficulty', () => {
    expect(firstPhaseForAto(3)).toBe(151);
  });

  it('resolves base map display names by phase index', () => {
    expect(phaseMapDisplayName(71, 'pt')).toBe('Salão Congelado');
    expect(phaseMapDisplayName(71, 'en')).toBe('Frozen Hall');
    expect(phaseMapDisplayName(151, 'en')).toBe('First Strike');
  });
});
