import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  abilityMods,
  fuseSeconds,
  marginalFuseSeconds,
  FUSE_FLOOR,
  houseRestSeconds,
  resolveHouseRestSeconds,
  splitHouseRest,
  isSheetAbility,
  levelPowerMult,
  mitigationFactor,
  critFactor,
  predictHitDamage,
  bombsPerSecond,
  activeDps,
  sustainedDps,
  energySwitchPoint,
  rankNextPoint,
  BASE_ROLLS,
  POINT_GAIN,
  attackPointGain,
  STAT_CAPS,
  critMilestones,
  GRID_SPEED_COEF,
  EFF_IA,
  type HeroSheet,
  type Context,
  type AbilityMods,
  type EffectiveDeltas,
} from '@bombfarm/domain/model';

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

describe('GRID_SPEED_COEF / EFF_IA', () => {
  it('are importable from @bombfarm/domain/model and equal their wiki-sourced values', () => {
    expect(GRID_SPEED_COEF).toBe(0.0386);
    expect(EFF_IA).toBe(0.9);
  });
});

describe('fuseSeconds', () => {
  it('applies CDR and respects the 0.4s floor (20% of cycle / 80% CDR cap)', () => {
    expect(fuseSeconds(0)).toBe(2);
    expect(fuseSeconds(25)).toBe(1.5);
    expect(fuseSeconds(70)).toBeCloseTo(0.6, 6);
    expect(fuseSeconds(80)).toBe(FUSE_FLOOR);
    expect(fuseSeconds(90)).toBe(FUSE_FLOOR);
  });
});

describe('marginalFuseSeconds', () => {
  it('is linear to the 80% stat cap with no early floor', () => {
    expect(marginalFuseSeconds(0)).toBe(2);
    expect(marginalFuseSeconds(70)).toBeCloseTo(0.6, 6);
    expect(marginalFuseSeconds(75)).toBeCloseTo(0.5, 6);
    expect(marginalFuseSeconds(80)).toBeCloseTo(0.4, 6);
    expect(marginalFuseSeconds(90)).toBeCloseTo(0.4, 6);
  });
});

describe('levelPowerMult', () => {
  it('scales +4% per level above 1', () => {
    expect(levelPowerMult(1)).toBe(1);
    expect(levelPowerMult(26)).toBeCloseTo(2, 6);
  });
});

describe('attackPointGain', () => {
  it('is +10 × levelPowerMult (L50 → +29.6)', () => {
    expect(attackPointGain(1)).toBe(10);
    expect(attackPointGain(50)).toBeCloseTo(29.6, 10);
  });
});

describe('hit math', () => {
  it('computes mitigation and crit factors', () => {
    expect(mitigationFactor(0.5, 0)).toBe(0.5);
    expect(mitigationFactor(0.5, 50)).toBe(0.75);
    expect(mitigationFactor(0.5, 100)).toBe(1);
    expect(mitigationFactor(0.5, 134)).toBe(1);
    expect(critFactor(10, 100)).toBeCloseTo(1.1, 6);
    expect(critFactor(120, 100)).toBeCloseTo(critFactor(100, 100), 6);
  });

  it('predicts white hit damage', () => {
    const hit = predictHitDamage(100, 0.1, 0, 1.2);
    expect(hit).toBeCloseTo(100 * 0.9 * 1.2, 6);
  });
});

describe('bombs / DPS', () => {
  it('serial cycle uses fuse + walk delay', () => {
    const h = sampleHero();
    const ctx = baseCtx();
    const rate = bombsPerSecond(h, ctx);
    expect(rate).toBeCloseTo(1 / (fuseSeconds(h.cdr) + ctx.walkDelay), 8);
  });

  it('sustained DPS is active × duty cycle', () => {
    const h = sampleHero();
    const ctx = baseCtx();
    const active = activeDps(h, ctx);
    const sustained = sustainedDps(h, ctx);
    const duty = h.energy / (h.energy + ctx.restSeconds);
    expect(sustained).toBeCloseTo(active * duty, 6);
  });

  it('active DPS applies the blast-range multiplier (1 + 0.5 × range)', () => {
    const h = sampleHero();
    const ctx = baseCtx();
    const dano = h.attack * mitigationFactor(ctx.mitigation, h.penetration) * critFactor(h.critChance, h.critDmg);
    expect(activeDps(h, ctx)).toBeCloseTo(dano * bombsPerSecond(h, ctx) * (1 + 0.5 * ctx.blastRange) * 0.9, 6);

    const widerCtx = { ...ctx, blastRange: 3 }; // base 1 + Explosão Ampla max (+2 at level 10)
    expect(activeDps(h, widerCtx)).toBeGreaterThan(activeDps(h, ctx));
  });
});

describe('abilityMods', () => {
  it('stacks modeled combat effects (W3 rank-20 perLevel values)', () => {
    const m = abilityMods({
      bateria_extra: 5,
      ponta_diamante: 3,
      grito_guerra: 2,
      olho_clinico: 10,
      pressagio_mortal: 4,
    });
    expect(m.drainMult).toBeCloseTo(0.95, 6);
    expect(m.penetrationPp).toBe(0);
    expect(m.sheetPenetrationRaw).toBe(3);
    expect(m.attackMult).toBeCloseTo(1.02, 6);
    // Percent-of-base since the 2026-08-18 revert: 10 x 4.285714285714286 and 4 x 5.714285714285714.
    expect(m.sheetCritChancePctOfBase).toBeCloseTo(42.85714285714286, 6);
    expect(m.combatCritChancePctOfBase).toBeCloseTo(22.857142857142858, 6);
  });

  it('treats Ponta de Diamante as on-sheet raw Σ (not combat penetrationPp)', () => {
    expect(isSheetAbility(ABILITIES.find((a) => a.id === 'ponta_diamante')!)).toBe(true);
    expect(abilityMods({ ponta_diamante: 0 }).sheetPenetrationRaw).toBe(0);
    expect(abilityMods({ ponta_diamante: 1 }).sheetPenetrationRaw).toBe(1);
    expect(abilityMods({ ponta_diamante: 20 }).sheetPenetrationRaw).toBe(20);
    expect(abilityMods({ ponta_diamante: 10 }).penetrationPp).toBe(0);
  });

  it('models Explosão Ampla as +0.1 rangeCells per level, +2 at rank 20 (W3: 0.2 → 0.1)', () => {
    const maxed: AbilityMods = abilityMods({ explosao_ampla: 20 });
    expect(maxed.rangeCells).toBeCloseTo(2, 6);
    expect(abilityMods({}).rangeCells).toBe(0);
  });
});

describe('rankNextPoint', () => {
  it('returns all stats ranked by gain', () => {
    const ranking = rankNextPoint(sampleHero(), baseCtx());
    expect(ranking).toHaveLength(7);
    expect(ranking[0].gainPct).toBeGreaterThanOrEqual(ranking[6].gainPct);
  });

  it('AC-46: BASE_ROLLS does not influence the ranking when effectiveDeltas is supplied (L-02, GAP-W2-01)', () => {
    // The behavioural property, not a grep: a hostile rarity ('Mítico' on a Comum-rolled
    // sheet — the rarities have very different BASE_ROLLS) must produce a byte-identical
    // ranking to the honest 'Comum' rarity, proving `deltaForStat` never falls back to
    // BASE_ROLLS once effectiveDeltas is present.
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 0.5,
      cdr: 1,
    };
    const honest = rankNextPoint({ ...sampleHero(), rarity: 'Comum' }, baseCtx(), { effectiveDeltas: deltas });
    const hostile = rankNextPoint({ ...sampleHero(), rarity: 'Mítico' }, baseCtx(), { effectiveDeltas: deltas });
    expect(hostile).toEqual(honest);
  });

  it('scores zero for crit chance at 100% cap', () => {
    const h: HeroSheet = { ...sampleHero(), critChance: STAT_CAPS.critChance };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 0.5,
      cdr: 1,
    };
    const ranking = rankNextPoint(h, baseCtx(), { effectiveDeltas: deltas });
    const crit = ranking.find((r) => r.stat === 'critChance');
    expect(crit?.gainPct).toBe(0);
  });

  it('scores zero for CDR at 80% cap', () => {
    const h: HeroSheet = { ...sampleHero(), cdr: STAT_CAPS.cdr };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 0.5,
      cdr: 5,
    };
    const ranking = rankNextPoint(h, baseCtx(), { effectiveDeltas: deltas });
    const cdr = ranking.find((r) => r.stat === 'cdr');
    expect(cdr?.gainPct).toBe(0);
  });

  it('still ranks CDR above zero at 70% and real DPS still improves toward the 80% cap', () => {
    const h: HeroSheet = { ...sampleHero(), cdr: 70 };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 0.5,
      cdr: 0.5,
    };
    const ctx = baseCtx();
    const ranking = rankNextPoint(h, ctx, { effectiveDeltas: deltas });
    const cdr = ranking.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBeGreaterThan(0);
    // Floor is 0.4s at 80% CDR — 70→75 still shortens real fuse.
    const cur = sustainedDps(h, ctx);
    const next = sustainedDps({ ...h, cdr: 75 }, ctx);
    expect(next).toBeGreaterThan(cur);
  });

  it('CDR gain stays positive from 70% up to 79% (zero only at 80% cap)', () => {
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 0.5,
      cdr: 1,
    };
    const ctx = baseCtx();
    for (const cdr of [70, 75, 79]) {
      const gain = rankNextPoint({ ...sampleHero(), cdr }, ctx, { effectiveDeltas: deltas }).find(
        (r) => r.stat === 'cdr',
      )!.gainPct;
      expect(gain).toBeGreaterThan(0);
    }
  });

  it('still ranks penetration above zero at 70% (below 100% combat bypass)', () => {
    const h: HeroSheet = { ...sampleHero(), penetration: 70 };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 1,
      cdr: 1,
    };
    const ctx = { ...baseCtx(), mitigation: 0.5 };
    const pen = rankNextPoint(h, ctx, { effectiveDeltas: deltas }).find((r) => r.stat === 'penetration')!;
    expect(pen.gainPct).toBeGreaterThan(0);
  });

  it('scores zero for penetration at 100% combat bypass cap', () => {
    const h: HeroSheet = { ...sampleHero(), penetration: STAT_CAPS.penetration };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 1,
      cdr: 1,
    };
    const ctx = { ...baseCtx(), mitigation: 0.5 };
    const pen = rankNextPoint(h, ctx, { effectiveDeltas: deltas }).find((r) => r.stat === 'penetration');
    expect(pen?.gainPct).toBe(0);
  });

  it('scores zero for penetration above 100% on sheet (combat already saturated)', () => {
    const h: HeroSheet = { ...sampleHero(), penetration: 134 };
    const deltas: EffectiveDeltas = {
      attack: 10,
      energy: 8,
      speed: 1,
      critChance: 2,
      critDmg: 8,
      penetration: 2,
      cdr: 1,
    };
    const ctx = { ...baseCtx(), mitigation: 0.5 };
    const pen = rankNextPoint(h, ctx, { effectiveDeltas: deltas }).find((r) => r.stat === 'penetration');
    expect(pen?.gainPct).toBe(0);
    const cur = sustainedDps(h, ctx);
    const next = sustainedDps({ ...h, penetration: 136 }, ctx);
    expect(next).toBeCloseTo(cur, 6);
  });

  it('uses effective deltas instead of naked-base shortcuts', () => {
    const h = sampleHero();
    const tiny: EffectiveDeltas = {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 50,
      penetration: 0,
      cdr: 0,
    };
    const ranking = rankNextPoint(h, baseCtx(), { effectiveDeltas: tiny });
    expect(ranking[0].stat).toBe('critDmg');
    expect(ranking[0].gainPct).toBeGreaterThan(ranking.find((r) => r.stat === 'attack')!.gainPct);
  });
});

describe('energySwitchPoint', () => {
  it('finds a finite crossover energy', () => {
    const sw = energySwitchPoint(sampleHero(), baseCtx());
    expect(sw).toBeGreaterThan(10);
    expect(sw).toBeLessThan(6000);
  });
});

describe('houseRestSeconds', () => {
  it('interpolates casa rest time', () => {
    expect(houseRestSeconds(0, 1)).toBe(19 * 60);
    expect(houseRestSeconds(0, 20)).toBe(17 * 60);
  });
});

describe('resolveHouseRestSeconds', () => {
  it('no cycleSecs at all (absent casa) — pure table path, unchanged behaviour', () => {
    expect(resolveHouseRestSeconds(null, 0, 11)).toBe(houseRestSeconds(0, 11));
    expect(resolveHouseRestSeconds(undefined, 2, 6)).toBe(houseRestSeconds(2, 6));
    expect(resolveHouseRestSeconds(0, 0, 11)).toBe(houseRestSeconds(0, 11));
    expect(resolveHouseRestSeconds(-5, 0, 11)).toBe(houseRestSeconds(0, 11));
  });

  it('no anchor supplied (3-arg call) trusts cycleSecs unconditionally — every non-web caller', () => {
    // account 486: Casa I level 11, casa.cycle_secs 1168.42105263158.
    expect(resolveHouseRestSeconds(1168.42105263158, 0, 11)).toBeCloseTo(1168.42105263158, 9);
    // Old (buggy) behaviour for a caller with no picker: the figure wins even for a DIFFERENT
    // house/level, because such a caller has no independent request to diverge from the import.
    expect(resolveHouseRestSeconds(1168.42105263158, 4, 1)).toBeCloseTo(1168.42105263158, 9);
  });

  it('requested house/level EQUAL the anchor — the exact save figure', () => {
    expect(resolveHouseRestSeconds(1168.42105263158, 0, 11, 0, 11)).toBeCloseTo(
      1168.42105263158,
      9,
    );
  });

  it('requested house DIFFERS from the anchor — table fallback, and the value actually changes', () => {
    const atAnchor = resolveHouseRestSeconds(1168.42105263158, 0, 11, 0, 11);
    const differentHouse = resolveHouseRestSeconds(1168.42105263158, 4, 11, 0, 11);
    expect(differentHouse).toBe(houseRestSeconds(4, 11));
    expect(differentHouse).not.toBeCloseTo(atAnchor, 0);
  });

  it('requested level DIFFERS from the anchor (same house) — table fallback, and the value actually changes', () => {
    const atAnchor = resolveHouseRestSeconds(1168.42105263158, 0, 11, 0, 11);
    const differentLevel = resolveHouseRestSeconds(1168.42105263158, 0, 1, 0, 11);
    expect(differentLevel).toBe(houseRestSeconds(0, 1));
    expect(differentLevel).not.toBeCloseTo(atAnchor, 0);
  });

  it('anchor explicitly known-absent (null) never matches — safe degrade, not a silent trust', () => {
    expect(resolveHouseRestSeconds(1168.42105263158, 0, 11, null, null)).toBe(
      houseRestSeconds(0, 11),
    );
  });
});

describe('splitHouseRest', () => {
  it('keeps remainder seconds from interpolated rest', () => {
    // Casa IV L7: 10 + ((8-10)*6)/19 → ~9m 22s
    expect(splitHouseRest(houseRestSeconds(3, 7))).toEqual({ minutes: 9, seconds: 22 });
    expect(splitHouseRest(19 * 60)).toEqual({ minutes: 19, seconds: 0 });
  });
});

describe('critMilestones (BSPW4-07, AC-47)', () => {
  it('uses the supplied per-hero base when given one, differing from the rarity-average fallback', () => {
    // Bellatrix's own birth crit chance (9.51) is well above Raro's rarity midpoint (7) —
    // pointsNeeded to reach the same targets must differ between the two paths.
    const bellatrixBase = { critChance: 9.51, critDmg: 167.344467136338 };
    const withBase = critMilestones('Raro', bellatrixBase);
    const fallback = critMilestones('Raro');
    expect(withBase).not.toEqual(fallback);
    for (let index = 0; index < withBase.length; index++) {
      expect(withBase[index].pointsNeeded).not.toBe(fallback[index].pointsNeeded);
    }
  });

  it('falls back to BASE_ROLLS[rarity] (a rarity-average estimate) when no base is supplied', () => {
    const fallback = critMilestones('Comum');
    const explicit = critMilestones('Comum', BASE_ROLLS.Comum);
    expect(fallback).toEqual(explicit);
  });
});

describe('BASE_ROLLS', () => {
  it('has midpoints for every rarity', () => {
    expect(BASE_ROLLS.Raro.attack).toBe(125);
    expect(BASE_ROLLS.Mítico.energy).toBe(1025);
  });
});
