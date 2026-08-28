import type { AbilityMods, Context, HeroSheet } from '../model';
import type { SheetOtherPct, SheetStats } from '../gear';
import type { SheetKey, SheetPanelKey } from '../planner-constants';

export type BreakdownStatId =
  | SheetPanelKey
  | 'mitF'
  | 'dmg'
  | 'hit'
  | 'criticalHit'
  | 'critFactor'
  | 'fuse'
  | 'bombsPerSecond'
  | 'fieldSeconds'
  | 'rest'
  | 'uptime'
  | 'activeDps'
  | 'sustainedDps';

export type LedgerOp = '+' | '×';
export type LedgerSource =
  | 'base'
  | 'level'
  | 'stars'
  | 'sheetAbilities'
  | 'gear'
  | 'points'
  | 'tree'
  | 'abilities'
  | 'team'
  | 'abilitiesTeam';
export type LedgerNote =
  | 'capped'
  | 'ownTeamSplit'
  | 'keenEye'
  | 'diamondTip'
  | 'brutalStrike';

/**
 * The four in-game lines, plus a `combat` bucket for the multiplicative sources that
 * sit below the sheet (`abilities` / `team` / `abilitiesTeam`) — real combat bonuses, not one
 * of the four sheet-building lines (DEC-07).
 */
export type LedgerGroup = 'hero' | 'gear' | 'ability' | 'skillTree' | 'combat';

/**
 * Exhaustive map from every `LedgerSource` to the game line it belongs to (`DEC-07`).
 * A display **grouping** over the existing ledger steps, not a re-cut: the arithmetic already
 * matches the game's decomposition (`AC-41`/`AC-42`, W4) — only the naming was missing. The
 * `Record` shape is exhaustive at compile time, so a future `LedgerSource` cannot be silently
 * ungrouped (`AC-28`).
 */
export const LEDGER_SOURCE_GROUP: Record<LedgerSource, LedgerGroup> = {
  base: 'hero',
  level: 'hero',
  stars: 'hero',
  points: 'hero',
  gear: 'gear',
  sheetAbilities: 'ability',
  tree: 'skillTree',
  abilities: 'combat',
  team: 'combat',
  abilitiesTeam: 'combat',
};

export interface LedgerStep {
  source: LedgerSource;
  op: LedgerOp;
  amount: number;
  running: number;
  note?: LedgerNote;
  /** Percentage points for `ownTeamSplit` (e.g. 20 → +20%). */
  splitOwn?: number;
  splitTeam?: number;
  /** When set, UI shows `percent% × base` instead of a bare additive amount. */
  pctOfBase?: { percent: number; base: number };
}

export interface FormulaBreakdown {
  kind: 'formula';
  expressionKey: string;
  substituted: string;
  value: number;
}

export type StatBreakdown =
  | { kind: 'ledger'; total: number; steps: LedgerStep[] }
  | FormulaBreakdown;

export interface PipelineFacts {
  geared?: SheetStats;
  adjusted: SheetStats;
  pts: Record<SheetKey, number>;
  delta: Record<SheetKey, number>;
  effective: HeroSheet;
  mods: AbilityMods;
  sheetOther: SheetOtherPct;
  naked: SheetStats;
  /** Hero level used to peel `levelPowerMult` out of naked Attack. */
  level: number;
  /** Stars used to peel `starsMult` out of star-scaled naked stats. */
  stars: number;
  attackMult: number;
  energyMult: number;
  speedMult: number;
  critDmgMult: number;
  teamCritFlat: number;
  treeSpeed: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeEnergy: number;
  /** `skills.totals.luck_add × 100` — flat Luck percentage points (AD-BSP-22, `ledgerLuck`). */
  treeLuckFlatPct: number;
  context: Context;
  dmgMult: number;
  /** Tree damage mult (Dano Total) — factor in `dmgMult`. */
  treeDanoTotal: number;
  /** Extra damage % from Math check — factor in `dmgMult`. */
  extraDmgPct: number;
  active: number;
  dps: number;
  uptime: number;
  rest: number;
}
