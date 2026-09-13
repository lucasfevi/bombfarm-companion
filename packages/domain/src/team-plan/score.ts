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

/**
 * The `FarmContext` belongs in the key because a run can hold TWO of them: the DPS objective
 * scores against the account's own phase and mitigation, and the farm objective scores against
 * phase 1 / mitigation 0. Leave it out and a roster whose aura vector happens to be all-zero —
 * which it is whenever no scoped hero carries a team-buff ability — collides across the two, and
 * one pass is served the other's sheet.
 */
function farmSignature(farm: FarmContext): string {
  return `${farm.houseIdx}:${farm.houseLevel}:${farm.phase}:${farm.mitigationPct}:${farm.cycleSecs ?? ''}:${farm.cycleSecsHouseIdx ?? ''}:${farm.cycleSecsLevel ?? ''}`;
}

/**
 * Matilha's allies join the key only for a carrier. The figure moves whenever ANY other hero's
 * duty does, so keying every hero on it would miss the memo on nearly every round for a roster
 * that carries no Matilha at all — and a non-carrier's score does not read it.
 */
function alliesSignature(ctx: HeroPlanContext, fieldAllies: number): string {
  return ctx.mods.packDmgPctPerAlly > 0 ? `${fieldAllies}` : '';
}

function memoKey(
  ctx: HeroPlanContext,
  loadout: Loadout,
  pts: PointAlloc,
  auras: Record<TeamBuffId, number>,
  farm: FarmContext,
  fieldAllies: number,
): string {
  return `${ctx.heroId}|${loadoutSignature(loadout)}|${ptsSignature(pts)}|${auraSignature(auras)}|${farmSignature(farm)}|${alliesSignature(ctx, fieldAllies)}`;
}

export function createScoreMemo(maxEntries = TEAM_PLAN_MAX_SCORE_MEMO_ENTRIES): ScoreMemo {
  return { entries: new Map(), maxEntries };
}

/**
 * `fieldAllies` is the number of other heroes on the field beside this one — Matilha's allies,
 * priced as `computeCombatMults` prices them. Omitted reads as none; every objective that rotates
 * a roster supplies its own reading (`evaluate.ts`, `farm-objective.ts`).
 */
export function scoreHeroLoadout(
  ctx: HeroPlanContext,
  loadout: Loadout,
  pts: PointAlloc,
  auras: Record<TeamBuffId, number>,
  farm: FarmContext,
  memo?: ScoreMemo,
  fieldAllies = 0,
): HeroScore {
  const key = memoKey(ctx, loadout, pts, auras, farm, fieldAllies);
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
    runes: ctx.runes,
  });

  const mults = computeCombatMults({
    mods: ctx.mods,
    teamBuffs: auras,
    extraDmgPct: 0,
    fieldAllies,
  });

  const context = farmContextForHero({
    mods: ctx.mods,
    teamDrainMult: mults.teamDrainMult,
    houseIdx: farm.houseIdx,
    houseLevel: farm.houseLevel,
    mitigationPct: farm.mitigationPct,
    phase: farm.phase,
    cycleSecs: farm.cycleSecs,
    cycleSecsHouseIdx: farm.cycleSecsHouseIdx,
    cycleSecsLevel: farm.cycleSecsLevel,
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
    teamCritFlat: mults.teamCritFlat,
    treeSheet: ctx.treeSheet,
    penetrationPp: mults.teamPenFlat,
    context,
    dmgMult: mults.dmgMult,
    mitigationPct: farm.mitigationPct,
    runes: ctx.runes,
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
