import { fieldSeconds } from '../model';
import { computeCombatMults, derive } from '../derive';
import { farmContextForHero } from '../farm-context';
import { composeSheetFromBirth, nakedFromBirth } from '../birth-sheet';
import { SHEET_KEYS, ZERO_PTS } from '../planner-constants';
import { SLOTS } from '../gear/catalog';
import { TEAM_BUFF_ABILITY_IDS } from '../team-buffs';
import type { FarmContext, HeroPlanContext, HeroScore, ScoreMemo } from './types';
import type { Loadout, PointAlloc, Slot } from '../gear/types';
import type { TeamBuffId } from '../team-buffs';

export type { ScoreMemo } from './types';

/**
 * Default ceiling on memoised hero scores.
 *
 * Small on purpose, and the cap was swept rather than guessed. On a real 348-item, 15-hero save
 * at a 100,000-evaluation budget an entry measured 2.8-4.0 KB (a `HeroScore` carries a
 * `HeroSheet`, `EffectiveDeltas`, `SheetStats` and a `Context`), and the whole benefit of the
 * memo is already there at 1,000 entries: 0 -> 19.8s, 1,000 -> 17.3s, 25,000 -> 18.8s on a 50,000
 * budget (three runs each). Raising it only costs — 150,000 entries retained 402 MB and ran
 * SLOWER than 25,000 (36.6s vs 34.4s at 100,000) on GC pressure alone.
 *
 * The reason so little is needed: the hill-climb's working set is local. A gear move changes one
 * hero, so the neighbours being scored share the other 14 heroes' loadouts, and the entries worth
 * keeping are only the ones from the last few evaluations.
 */
export const TEAM_PLAN_MAX_SCORE_MEMO_ENTRIES = 5_000;

/**
 * The three signature builders below walk a fixed, module-level key list instead of
 * `Object.entries(...).sort(...)`. The key sets are closed — `Slot` for a `Loadout`,
 * `SheetKey` for a `PointAlloc`, `TeamBuffId` for the auras — so a fixed order is as
 * discriminating as a sorted one, without the per-call array, tuple and comparator churn.
 * The memo runs this per hero per fixed-point round per roster evaluation, and profiling put
 * the three of them plus their comparators at ~29% of a team-plan run.
 *
 * Positional, not sorted-by-name: the key is an internal cache key, never persisted or
 * compared across versions, so only injectivity matters.
 */
const SIGNATURE_SLOTS: readonly Slot[] = [...SLOTS].sort((a, b) => a.localeCompare(b));

function loadoutSignature(loadout: Loadout): string {
  let out = '';
  for (const slot of SIGNATURE_SLOTS) {
    const item = loadout[slot];
    out += item
      ? `${slot}:${item.defId}|${item.rarityIdx}|${item.level}|${item.upgrade};`
      : `${slot}:null;`;
  }
  return out;
}

function ptsSignature(pts: PointAlloc): string {
  let out = '';
  for (const key of SHEET_KEYS) out += `${key}:${pts[key]};`;
  return out;
}

function auraSignature(auras: Record<TeamBuffId, number>): string {
  let out = '';
  for (const buffId of TEAM_BUFF_ABILITY_IDS) out += `${buffId}:${auras[buffId]};`;
  return out;
}

function memoKey(
  heroId: string,
  loadout: Loadout,
  pts: PointAlloc,
  auras: Record<TeamBuffId, number>,
): string {
  return `${heroId}|${loadoutSignature(loadout)}|${ptsSignature(pts)}|${auraSignature(auras)}`;
}

export function createScoreMemo(maxEntries = TEAM_PLAN_MAX_SCORE_MEMO_ENTRIES): ScoreMemo {
  return { entries: new Map(), maxEntries };
}

export function scoreHeroLoadout(
  ctx: HeroPlanContext,
  loadout: Loadout,
  pts: PointAlloc,
  auras: Record<TeamBuffId, number>,
  farm: FarmContext,
  memo?: ScoreMemo,
): HeroScore {
  const key = memoKey(ctx.heroId, loadout, pts, auras);
  if (memo) {
    const hit = memo.entries.get(key);
    if (hit) return hit;
  }

  const naked = nakedFromBirth(ctx.birth, ctx.level, ctx.stars, ctx.sheetOther);
  // `derive()` (see its doc comment) adds spent points itself via `pts * delta` — its
  // `geared` input must therefore be the zero-points sheet, same contract as
  // `sheetsFromBirth`'s `geared` (birth-sheet.ts) and import-save.ts's `gearedOverride`.
  // Composing with the real `pts` here would double-count every spent point (once via
  // `applyPoints` inside `composeSheetFromBirth`, once via `derive`'s own delta formula).
  const geared = composeSheetFromBirth({
    birth: ctx.birth,
    level: ctx.level,
    stars: ctx.stars,
    sheetOther: ctx.sheetOther,
    loadout,
    pts: ZERO_PTS(),
    tree: ctx.treeSheet,
  });

  const mults = computeCombatMults({
    mods: ctx.mods,
    teamBuffs: auras,
    extraDmgPct: 0,
  });

  const context = farmContextForHero({
    mods: ctx.mods,
    teamDrainMult: mults.teamDrainMult,
    houseIdx: farm.houseIdx,
    houseLevel: farm.houseLevel,
    mitigationPct: farm.mitigationPct,
    phase: farm.phase,
    cycleSecs: farm.cycleSecs,
  });

  const deriveResult = derive({
    geared,
    naked,
    sheetOther: ctx.sheetOther,
    pts,
    rarity: ctx.rarity,
    level: ctx.level,
    stars: ctx.stars,
    attackMult: mults.attackMult,
    energyMult: mults.energyMult,
    speedMult: mults.speedMult,
    critDmgMult: mults.critDmgMult,
    teamCritPctOfBase: mults.teamCritPctOfBase,
    treeSheet: ctx.treeSheet,
    combatCritChancePctOfBase: ctx.mods.combatCritChancePctOfBase,
    penetrationPp: ctx.mods.penetrationPp,
    context,
    dmgMult: mults.dmgMult,
    mitigationPct: farm.mitigationPct,
  });

  const fieldSecondsValue = fieldSeconds(deriveResult.effective, context);
  const duty =
    fieldSecondsValue <= 0
      ? 0
      : fieldSecondsValue / (fieldSecondsValue + context.restSeconds);

  const score: HeroScore = {
    sustained: deriveResult.dps,
    active: deriveResult.active,
    duty,
    fieldSeconds: fieldSecondsValue,
    effective: deriveResult.effective,
    effectiveDelta: deriveResult.effectiveDelta,
    context,
    adjusted: deriveResult.adjusted,
    hit: deriveResult.hit,
  };

  if (memo) {
    // FIFO rather than "stop caching when full": the search's working set moves as it climbs,
    // so the entries worth keeping are the recent ones. `Map` iterates in insertion order, so
    // the first key is always the oldest.
    while (memo.entries.size >= memo.maxEntries) {
      const oldest = memo.entries.keys().next();
      if (oldest.done) break;
      memo.entries.delete(oldest.value);
    }
    memo.entries.set(key, score);
  }
  return score;
}
