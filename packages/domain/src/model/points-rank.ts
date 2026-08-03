import {
  critFactor,
  marginalFuseSeconds,
  mitigationFactor,
  sustainedDps,
  sustainedDpsWithFuse,
} from '@/shared/domain/model/combat';
import { BASE_ROLLS, POINT_GAIN, STAT_CAPS } from '@/shared/domain/model/rarity-constants';
import {
  STAT_LABELS,
  type Context,
  type HeroSheet,
  type PointBases,
  type PointValue,
  type RankOptions,
  type StatKey,
} from '@/shared/domain/model/types';

function hitSize(hero: HeroSheet, mitigation: number, hitDmgMult: number): number {
  return hero.attack * mitigationFactor(mitigation, hero.penetration) * hitDmgMult * critFactor(hero.critChance, hero.critDmg);
}

function isRankOptions(options: PointBases | RankOptions): options is RankOptions {
  return (
    'bases' in options ||
    'effectiveDeltas' in options ||
    'mode' in options ||
    'targetPropHp' in options ||
    'hitDmgMult' in options ||
    'mitigation' in options
  );
}

function normalizeRankOpts(options?: PointBases | RankOptions): RankOptions {
  if (!options) return {};
  if (isRankOptions(options)) return options;
  return { bases: options };
}

/**
 * BSPW4-09 (BSP-58/60, AC-56): the ONLY non-damage consumer of `STAT_CAPS.penetration`.
 * Sheet penetration is never clamped (`AC-53`) — this caps the *ranking* only, because past
 * 100% mitigation is already fully bypassed and an additional point buys no further gain
 * there. That is a scoring decision, not a second sheet clamp.
 */
function statCap(stat: StatKey): number | null {
  if (stat === 'critChance') return STAT_CAPS.critChance;
  if (stat === 'penetration') return STAT_CAPS.penetration;
  if (stat === 'cdr') return STAT_CAPS.cdr;
  return null;
}

/** Apply one point's delta on the effective sheet, respecting hard caps. */
function applyEffectivePoint(hero: HeroSheet, stat: StatKey, delta: number): Partial<HeroSheet> {
  if (delta <= 0) return {};
  const current = hero[stat];
  const cap = statCap(stat);
  const next = cap != null ? Math.min(current + delta, cap) : current + delta;
  if (next <= current + 1e-12) return {};
  return { [stat]: next };
}

function deltaForStat(
  stat: StatKey,
  hero: HeroSheet,
  options: RankOptions,
  base: PointBases,
): number {
  const fromDerive = options.effectiveDeltas?.[stat];
  if (fromDerive != null) return fromDerive;
  switch (stat) {
    case 'attack':
      return hero.attackPerPoint;
    case 'energy':
      return hero.energyPerPoint;
    case 'critDmg':
      return POINT_GAIN.critDmgPctOfBase * base.critDmg;
    case 'speed':
      return POINT_GAIN.speedPctOfBase * base.speed;
    case 'critChance':
      return POINT_GAIN.critChancePctOfBase * base.critChance;
    case 'penetration':
      return POINT_GAIN.penetrationPctOfBase * base.penetration;
    case 'cdr':
      return POINT_GAIN.cdrPctOfBase * base.cdr;
  }
}

/**
 * Marginal % gain for one point in each stat, ranked best-first.
 * Uses effective-sheet deltas (tree/gear/mults already baked in) and hard caps
 * on crit chance (100%), penetration (100% combat bypass), and CDR (80%).
 * `oneshot` mode mixes sustained DPS gain
 * with progress toward oneshotting `targetPropHp`.
 */
export function rankNextPoint(hero: HeroSheet, context: Context, optionsOrBases?: PointBases | RankOptions): PointValue[] {
  const options = normalizeRankOpts(optionsOrBases);
  const roll = BASE_ROLLS[hero.rarity];
  const base = {
    speed: options.bases?.speed ?? roll.speed,
    critChance: options.bases?.critChance ?? roll.critChance,
    critDmg: options.bases?.critDmg ?? roll.critDmg,
    penetration: options.bases?.penetration ?? roll.penetration,
    cdr: options.bases?.cdr ?? roll.cdr,
  };
  const current = sustainedDps(hero, context);
  const mit = options.mitigation ?? context.mitigation;
  const dmgMult = options.hitDmgMult ?? 1;
  const propHp = options.targetPropHp ?? 0;
  const useOneshot = options.mode === 'oneshot' && propHp > 0;
  const curHit = hitSize(hero, mit, dmgMult);

  const score = (patch: Partial<HeroSheet>, stat: StatKey, hitRelevant: boolean) => {
    if (Object.keys(patch).length === 0) return 0;
    const next = { ...hero, ...patch };
    // MOD-36: single-pass branch assign — the CDR-fuse special case vs. the plain-DPS
    // ratio below each set this exactly once before it's read.
    let dpsGain: number;
    // Real fuse floors at 70% CDR, but stat cap is 80% — rank CDR with linear fuse until cap.
    if (stat === 'cdr' && hero.cdr < STAT_CAPS.cdr - 1e-9 && context.cycleModel === 'serial') {
      const curFuse = marginalFuseSeconds(hero.cdr);
      const nextFuse = marginalFuseSeconds(next.cdr);
      const curMarginal = sustainedDpsWithFuse(hero, context, curFuse);
      const nextMarginal = sustainedDpsWithFuse(next, context, nextFuse);
      dpsGain = (nextMarginal / curMarginal - 1) * 100;
    } else {
      dpsGain = (sustainedDps(next, context) / current - 1) * 100;
    }
    if (!useOneshot || !hitRelevant) return dpsGain;
    const nextHit = hitSize(next, mit, dmgMult);
    const before = Math.ceil(propHp / Math.max(curHit, 1e-9));
    const after = Math.ceil(propHp / Math.max(nextHit, 1e-9));
    // Large bonus when a point drops hits-to-kill; otherwise weight leftover gap.
    const breakpointBonus = before > after ? 5 + (before - after) * 3 : 0;
    const gapShrink =
      curHit >= propHp ? 0 : Math.max(0, ((nextHit - curHit) / propHp) * 100);
    return dpsGain + breakpointBonus + gapShrink * 0.25;
  };

  const stats: StatKey[] = ['energy', 'attack', 'critDmg', 'speed', 'critChance', 'penetration', 'cdr'];
  const hitRelevant = new Set<StatKey>(['attack', 'critDmg', 'critChance', 'penetration']);
  const out: PointValue[] = stats.map((stat) => {
    const delta = deltaForStat(stat, hero, options, base);
    const patch = applyEffectivePoint(hero, stat, delta);
    return {
      stat,
      label: STAT_LABELS[stat],
      dpsGainPct: score(patch, stat, hitRelevant.has(stat)),
    };
  });
  return out.sort((left, right) => right.dpsGainPct - left.dpsGainPct);
}

/** Energy at which one energy point equals one attack point (given current attack). */
export function energySwitchPoint(hero: HeroSheet, context: Context): number {
  // MOD-36: genuine accumulators — binary-search bounds narrowed each iteration below;
  // each bound's next value depends on its own (and the loop's) prior state.
  let low = 10;
  let high = 6000;
  for (let index = 0; index < 60; index++) {
    const mid = (low + high) / 2;
    const test = { ...hero, energy: mid };
    const energyValue = sustainedDps({ ...test, energy: mid + hero.energyPerPoint }, context) / sustainedDps(test, context);
    const attackValue = sustainedDps({ ...test, attack: hero.attack + hero.attackPerPoint }, context) / sustainedDps(test, context);
    if (energyValue > attackValue) low = mid;
    else high = mid;
  }
  return Math.round((low + high) / 2);
}
