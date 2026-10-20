import { describe, expect, it } from 'vitest';
import {
  activeDps,
  bombsPerSecond,
  duelCadenceMultiplier,
  marginalFuseSeconds,
  rankNextPoint,
  sustainedDps,
  type Context,
  type EffectiveDeltas,
  type HeroSheet,
} from '@bombfarm/domain/model';
import { sustainedDpsWithFuse } from '@bombfarm/domain/model/combat';
import { optimizeBuild } from '@bombfarm/domain/points-reopt';
import { ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';

const fastCapped: HeroSheet = {
  rarity: 'Lendária',
  attack: 20000,
  energy: 120,
  speed: 4.5 / 0.0386,
  critChance: 100,
  critDmg: 600,
  penetration: 0,
  cdr: 33,
  attackPerPoint: 150,
  energyPerPoint: 8,
};
const fastCappedDelta: EffectiveDeltas = {
  attack: 150,
  energy: 8,
  speed: 1.2,
  critChance: 0.6,
  critDmg: 5,
  penetration: 0.5,
  cdr: 0.6,
};
const fastCappedPts: Record<SheetKey, number> = {
  ...ZERO_PTS(),
  attack: 100,
  energy: 20,
  speed: 20,
  critChance: 40,
  critDmg: 100,
  cdr: 20,
};
const fastCappedLevel = 300;

const gateClear: Context = { restSeconds: 600, mitigation: 0.2, blastRange: 1, ato: 3, drainMult: 1, windowSecs: 60 };
const duel: Context = { ...gateClear, combat: 'duel' };
const farm: Context = { restSeconds: 600, mitigation: 0.2, blastRange: 1, ato: 3, drainMult: 1 };

describe('duelCadenceMultiplier', () => {
  it('reads ×1.55 at the fuse floor, ×1.27 at 1.0 s, ×1.20 at 1.34 s, ×1.12 at 1.8 s and ×1.10 at the 2 s base', () => {
    expect(duelCadenceMultiplier(0.4)).toBeCloseTo(1.5496, 3);
    expect(duelCadenceMultiplier(1.0)).toBeCloseTo(1.2736, 3);
    expect(duelCadenceMultiplier(1.34)).toBeCloseTo(1.1962, 3);
    expect(duelCadenceMultiplier(1.8)).toBe(1.123);
    expect(duelCadenceMultiplier(2.0)).toBeCloseTo(1.098, 3);
  });

  it('holds flat outside the 0.4–2.0 s fuse range it was fitted on', () => {
    expect(duelCadenceMultiplier(0.1)).toBe(duelCadenceMultiplier(0.4));
    expect(duelCadenceMultiplier(3)).toBe(duelCadenceMultiplier(2));
  });

  it('grows as the fuse shortens', () => {
    for (let fuse = 0.5; fuse <= 2; fuse += 0.1) {
      expect(duelCadenceMultiplier(fuse - 0.1)).toBeGreaterThan(duelCadenceMultiplier(fuse));
    }
  });
});

describe('the duel cadence in the combat model', () => {
  it('a duel context plants faster by the multiplier at the hero’s own fuse', () => {
    const fuse = 2 * (1 - fastCapped.cdr / 100);
    expect(bombsPerSecond(fastCapped, duel) / bombsPerSecond(fastCapped, gateClear)).toBeCloseTo(duelCadenceMultiplier(fuse), 12);
    expect(activeDps(fastCapped, duel) / activeDps(fastCapped, gateClear)).toBeCloseTo(duelCadenceMultiplier(fuse), 12);
    expect(sustainedDps(fastCapped, duel) / sustainedDps(fastCapped, gateClear)).toBeCloseTo(duelCadenceMultiplier(fuse), 12);
  });

  it('the marginal-fuse pricing reads the multiplier at the fuse it is handed', () => {
    const fuse = marginalFuseSeconds(70);
    const ratio = sustainedDpsWithFuse(fastCapped, duel, fuse) / sustainedDpsWithFuse(fastCapped, gateClear, fuse);
    expect(ratio).toBeCloseTo(duelCadenceMultiplier(fuse), 12);
  });

  it('a gate clear keeps the farm cadence to the bit — its window alone does not make it a duel', () => {
    expect(bombsPerSecond(fastCapped, gateClear)).toBe(bombsPerSecond(fastCapped, farm));
    expect(activeDps(fastCapped, gateClear)).toBe(activeDps(fastCapped, farm));
  });

  it('the next-point ranking values cooldown more in a duel than at a gate', () => {
    const cdrGain = (context: Context) =>
      rankNextPoint(fastCapped, context, { effectiveDeltas: fastCappedDelta }).find((row) => row.stat === 'cdr')!.gainPct;
    expect(cdrGain(duel)).toBeGreaterThan(cdrGain(gateClear));
  });

  it('a duel build on a fast hero at the crit cap puts more points into cooldown than the farm cadence did', () => {
    const build = (context: Context) =>
      optimizeBuild({ pts: fastCappedPts, effective: fastCapped, effectiveDelta: fastCappedDelta, context, level: fastCappedLevel });
    const atGate = build(gateClear);
    const inDuel = build(duel);
    expect(inDuel.pts.cdr).toBeGreaterThan(atGate.pts.cdr);
  });
});
