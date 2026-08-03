/**
 * BSPW4-02 — the game's own four tooltip lines (Hero / Gear / Ability / Skill tree) per
 * sheet key, derived from the same inputs `composeSheetFromBirth` consumes. The four
 * lines always sum to `composeSheetFromBirth`'s value for that key (AC-10).
 *
 * The in-game "Hero" line bundles the player's spent points with the birth roll (there is
 * no separate "Points" tooltip row) — proven against the Bellatrix crit-damage tooltip
 * (`554.9184% = (1.67344467136338−1)×2×(1+39×0.08)×100`, AC-15). "Ability" is the
 * pool's on-sheet-ability share (`base × sheetOther[key]`); for attack/energy there is no
 * ability pool term, so `ability` is structurally `0` there. The skill-tree line uses the
 * SAME `base = naked[key]/(1+sheetOther[key])` the additive `AD-BSP-22` shapes use in
 * `applySkillTree` — not the full hero+gear+ability subtotal — except for the
 * multiplicative-subtotal keys (attack, energy) and the flat-addend key (luck), where the
 * tree line is `(hero+gear+ability) × (factor−1)` / `luck_add × 100` respectively.
 */
import { attackPointGain, levelPowerMult } from '@/shared/domain/model/combat';
import { POINT_GAIN } from '@/shared/domain/model/rarity-constants';
import { starsMult, sumGearBonuses } from '@/shared/domain/gear/catalog';
import type { ComposeSheetFromBirthInput } from '@/shared/domain/birth-sheet';
import { type SheetKey } from '@/shared/domain/planner-constants';

/** The game's four tooltip lines for one sheet key, in tooltip order. */
export type SourceLines = { hero: number; gear: number; ability: number; skillTree: number };
export type SheetSourceLines = Record<SheetKey, SourceLines>;

/** Same inputs as `composeSheetFromBirth` (birth, level, stars, sheetOther, loadout, pts, tree). */
export type PeelSheetSourcesInput = ComposeSheetFromBirthInput;

/**
 * Shared-pool key (speed, critChance, critDmg, penetration, cdr, luck): the pool
 * `birthVal × starFactor × (1 + otherClamped + gearPct + ptsRate×ptsCount)` splits into
 * hero (birth + points), gear, ability (the on-sheet-ability share) and, for the additive
 * tree shapes, a skill-tree line based on the pre-ability `birthVal × starFactor` base.
 */
function pooledLines(
  birthVal: number,
  starFactor: number,
  otherPct: number,
  gearPct: number,
  ptsRate: number,
  ptsCount: number,
  treePct: number,
): SourceLines {
  const otherClamped = Math.max(0, otherPct);
  const base = birthVal * starFactor;
  return {
    hero: base * (1 + ptsRate * ptsCount),
    gear: base * gearPct,
    ability: base * otherClamped,
    skillTree: base * (treePct / 100),
  };
}

export function peelSheetSources(input: PeelSheetSourcesInput): SheetSourceLines {
  const { birth, level, stars, sheetOther, loadout, pts, tree } = input;
  const star = starsMult(stars);
  const bonuses = sumGearBonuses(loadout);

  // Attack: additive gear + additive points bundled into Hero; tree multiplies the subtotal.
  const atkPt = attackPointGain(level) * star;
  const attackHero = birth.attack * levelPowerMult(level) * star + pts.attack * atkPt;
  const attackGear = bonuses.dmgFlat;
  const attackPreTree = attackHero + attackGear;
  const attack: SourceLines = {
    hero: attackHero,
    gear: attackGear,
    ability: 0,
    skillTree: attackPreTree * (tree.danoStatic - 1),
  };

  // Energy: gear is a % of (hero, points-inclusive); tree multiplies the (hero+gear) subtotal.
  const energyHero = birth.energy * star + pts.energy * POINT_GAIN.energyNative * star;
  const energyGear = energyHero * bonuses.energyPct;
  const energyPreTree = energyHero + energyGear;
  const energy: SourceLines = {
    hero: energyHero,
    gear: energyGear,
    ability: 0,
    skillTree: energyPreTree * (tree.energyPct / 100),
  };

  const speed = pooledLines(
    birth.speed,
    1, // AD-BSP-19: speed is never star-scaled.
    sheetOther.speed,
    bonuses.speedPct,
    POINT_GAIN.speedPctOfBase,
    pts.speed,
    tree.speedPct,
  );
  const critChance = pooledLines(
    birth.critChance,
    star,
    sheetOther.critChance,
    bonuses.critPct,
    POINT_GAIN.critChancePctOfBase,
    pts.critChance,
    tree.critChancePct,
  );
  // Items never roll crit damage (gear/apply.ts) — gearPct is structurally 0.
  const critDmg = pooledLines(
    birth.critDmg,
    star,
    sheetOther.critDmg,
    0,
    POINT_GAIN.critDmgPctOfBase,
    pts.critDmg,
    tree.critDmgPct,
  );
  // AD-BSP-22: skills.totals has no node for penetration or cdr — tree line is exactly 0.
  const penetration = pooledLines(
    birth.penetration,
    star,
    sheetOther.penetration,
    bonuses.penPct,
    POINT_GAIN.penetrationPctOfBase,
    pts.penetration,
    0,
  );
  const cdr = pooledLines(birth.cdr, star, sheetOther.cdr, bonuses.cdrPct, POINT_GAIN.cdrPctOfBase, pts.cdr, 0);
  // Luck's tree term is a flat percentage-point addend (AD-BSP-22), not base × pct.
  const luck: SourceLines = {
    ...pooledLines(birth.luck, star, 0, bonuses.luckPct, POINT_GAIN.luckPctOfBase, pts.luck, 0),
    skillTree: tree.luckFlatPct,
  };

  return { attack, energy, speed, critChance, critDmg, penetration, cdr, luck };
}
