/**
 * Telescoping sheet stages for the read-only Stats panel: Birth + Δ level / stars /
 * ability / gear / points / tree = Total (`composeSheetFromBirth`).
 *
 * Distinct from {@link peelSheetSources}, which mirrors the game's four-line tooltip
 * (Hero bundles birth+points). These stages match the composition pipeline order so
 * each column is a marginal contribution and the columns sum to Total.
 */
import {
  applySkillTree,
  type BirthStats,
  type ComposeSheetFromBirthInput,
  nakedFromBirth,
} from './birth-sheet';
import { applyGear, applyPoints, starsMult } from './gear';
import { levelPowerMult } from './model/combat';
import { SHEET_KEYS, type SheetKey } from './planner-constants';
import { capSheetValue } from './sheet-view';
import type { SheetStats } from './gear/types';

/**
 * One sheet key's birth absolute + six marginal Δs + composed Total, plus the game's display
 * cap surfaced as its own pair of columns rather than folded into `total`.
 *
 * `total` stays UNCAPPED on purpose (see `birth-sheet.ts`'s `composeSheetFromBirth` doc
 * comment) — it must keep equalling `composeSheetFromBirth`'s output and the six Δs above must
 * keep summing to it, both asserted in `keystone-sheet-corrections.test.ts`. `deltaCap` is the
 * extra, always-non-positive Δ the game's display clamp applies on top (`0` under the cap);
 * `cappedTotal = total + deltaCap` is what the game's own exported sheet shows
 * (`gameSheetView(total-shaped-sheet) === cappedTotal`, `sheet-view.ts`).
 */
export type SheetStageRow = {
  birth: number;
  deltaLevel: number;
  deltaStars: number;
  deltaAbility: number;
  deltaGear: number;
  deltaPoints: number;
  deltaTree: number;
  total: number;
  /** ≤ 0; exactly 0 under the cap. The game's display clamp, shown as its own Δ. */
  deltaCap: number;
  /** `total + deltaCap` — what the game's exported sheet actually shows for this key. */
  cappedTotal: number;
};

export type SheetStageTable = Record<SheetKey, SheetStageRow>;

export type PeelSheetStagesInput = ComposeSheetFromBirthInput;

/** Birth at current level, ★0, no sheet abilities. */
function sheetAfterLevel(birth: BirthStats, level: number): SheetStats {
  const power = levelPowerMult(level);
  return {
    attack: birth.attack * power,
    energy: birth.energy,
    speed: birth.speed,
    critChance: birth.critChance,
    critDmg: birth.critDmg,
    penetration: birth.penetration,
    cdr: birth.cdr,
    luck: birth.luck,
  };
}

/** Birth at current level + stars, no sheet abilities. */
function sheetAfterStars(birth: BirthStats, level: number, stars: number): SheetStats {
  const power = levelPowerMult(level);
  const star = starsMult(stars);
  return {
    attack: birth.attack * power * star,
    energy: birth.energy * star,
    speed: birth.speed,
    critChance: birth.critChance * star,
    critDmg: birth.critDmg * star,
    penetration: birth.penetration * star,
    cdr: birth.cdr * star,
    luck: birth.luck * star,
  };
}

function stageRow(
  key: SheetKey,
  birth: number,
  afterLevel: number,
  afterStars: number,
  afterAbility: number,
  afterGear: number,
  afterPoints: number,
  total: number,
): SheetStageRow {
  const cappedTotal = capSheetValue(key, total);
  return {
    birth,
    deltaLevel: afterLevel - birth,
    deltaStars: afterStars - afterLevel,
    deltaAbility: afterAbility - afterStars,
    deltaGear: afterGear - afterAbility,
    deltaPoints: afterPoints - afterGear,
    deltaTree: total - afterPoints,
    total,
    deltaCap: cappedTotal - total,
    cappedTotal,
  };
}

/**
 * Peel one composed sheet into Birth + six Δ columns that sum to Total.
 * Uses the same inputs as {@link composeSheetFromBirth}.
 */
export function peelSheetStages(input: PeelSheetStagesInput): SheetStageTable {
  const { birth, level, stars, sheetOther, loadout, pts, tree } = input;
  const afterLevel = sheetAfterLevel(birth, level);
  const afterStars = sheetAfterStars(birth, level, stars);
  const afterAbility = nakedFromBirth(birth, level, stars, sheetOther);
  const afterGear = applyGear(afterAbility, loadout, sheetOther);
  const afterPoints = applyPoints(afterAbility, loadout, pts, sheetOther, level, stars);
  const total = applySkillTree(afterPoints, afterAbility, sheetOther, tree);

  const out = {} as SheetStageTable;
  for (const key of SHEET_KEYS) {
    out[key] = stageRow(
      key,
      birth[key],
      afterLevel[key],
      afterStars[key],
      afterAbility[key],
      afterGear[key],
      afterPoints[key],
      total[key],
    );
  }
  return out;
}
