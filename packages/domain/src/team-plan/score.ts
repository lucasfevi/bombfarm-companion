import { fieldSeconds } from '../model';
import { computeCombatMults, derive } from '../derive';
import { farmContextForHero } from '../farm-context';
import { composeSheetFromBirth, nakedFromBirth } from '../birth-sheet';
import { ZERO_PTS } from '../planner-constants';
import type { FarmContext, HeroPlanContext, HeroScore } from './types';
import type { Loadout, PointAlloc } from '../gear/types';
import type { TeamBuffId } from '../team-buffs';

export type ScoreMemo = Map<string, HeroScore>;

function loadoutSignature(loadout: Loadout): string {
  const parts: string[] = [];
  for (const [slot, item] of Object.entries(loadout).sort(([a], [b]) => a.localeCompare(b))) {
    if (!item) {
      parts.push(`${slot}:null`);
      continue;
    }
    parts.push(`${slot}:${item.defId}|${item.rarityIdx}|${item.level}|${item.upgrade}`);
  }
  return parts.join(';');
}

function ptsSignature(pts: PointAlloc): string {
  return Object.entries(pts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function auraSignature(auras: Record<TeamBuffId, number>): string {
  return Object.entries(auras)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function memoKey(
  heroId: string,
  loadout: Loadout,
  pts: PointAlloc,
  auras: Record<TeamBuffId, number>,
): string {
  return `${heroId}|${loadoutSignature(loadout)}|${ptsSignature(pts)}|${auraSignature(auras)}`;
}

export function createScoreMemo(): ScoreMemo {
  return new Map();
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
  if (memo?.has(key)) {
    return memo.get(key)!;
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
    treeGlassCannon: farm.treeGlassCannon,
    treeTempoDobrado: farm.treeTempoDobrado,
    treeAbisso: farm.treeAbisso,
    treeAbissoBase: farm.treeAbissoBase,
    phase: farm.phase,
    extraDmgPct: 0,
  });

  const context = farmContextForHero({
    mods: ctx.mods,
    teamDrainMult: mults.teamDrainMult,
    treeTempoDobrado: farm.treeTempoDobrado,
    houseIdx: farm.houseIdx,
    houseLevel: farm.houseLevel,
    mitigationPct: farm.mitigationPct,
    phase: farm.phase,
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
  };

  if (memo) memo.set(key, score);
  return score;
}
