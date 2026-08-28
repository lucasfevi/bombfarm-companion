import { SHEET_PANEL_KEYS, type SheetKey, type SheetPanelKey } from '../planner-constants';
import {
  formulaActive,
  formulaBombs,
  formulaCriticalHit,
  formulaCritFactor,
  formulaDmg,
  formulaField,
  formulaFuse,
  formulaHit,
  formulaMitF,
  formulaRest,
  formulaSustained,
  formulaUptime,
} from './formula-breakdowns';
import {
  ledgerAttack,
  ledgerCdr,
  ledgerCritChance,
  ledgerCritDmg,
  ledgerEnergy,
  ledgerLuck,
  ledgerPenetration,
  ledgerSpeed,
} from './sheet-ledgers';
import type {
  BreakdownStatId,
  FormulaBreakdown,
  PipelineFacts,
  StatBreakdown,
} from './types';

// Keyed by SHEET_PANEL_KEYS (8, incl. luck) — the display-surface list, not the
// 7-key combat/mismatch SHEET_DISPLAY_KEYS.
const SHEET_BUILDERS: Record<SheetPanelKey, (f: PipelineFacts) => StatBreakdown> = {
  attack: ledgerAttack,
  energy: ledgerEnergy,
  speed: ledgerSpeed,
  critChance: ledgerCritChance,
  critDmg: ledgerCritDmg,
  penetration: ledgerPenetration,
  cdr: ledgerCdr,
  luck: ledgerLuck,
};

const FORMULA_BUILDERS: Record<
  Exclude<BreakdownStatId, SheetKey>,
  (f: PipelineFacts) => FormulaBreakdown
> = {
  mitF: formulaMitF,
  dmg: formulaDmg,
  hit: formulaHit,
  criticalHit: formulaCriticalHit,
  critFactor: formulaCritFactor,
  fuse: formulaFuse,
  bombsPerSecond: formulaBombs,
  fieldSeconds: formulaField,
  rest: formulaRest,
  uptime: formulaUptime,
  activeDps: formulaActive,
  sustainedDps: formulaSustained,
};

export const BREAKDOWN_SHEET_IDS: readonly SheetPanelKey[] = SHEET_PANEL_KEYS;
export const BREAKDOWN_DERIVED_IDS: readonly Exclude<BreakdownStatId, SheetKey>[] = [
  'mitF',
  'dmg',
  'hit',
  'criticalHit',
  'critFactor',
  'fuse',
  'bombsPerSecond',
  'fieldSeconds',
  'rest',
  'uptime',
  'activeDps',
  'sustainedDps',
];

function isSheetStat(stat: BreakdownStatId): stat is SheetPanelKey {
  return (SHEET_PANEL_KEYS as readonly string[]).includes(stat);
}

export function buildStatBreakdown(stat: BreakdownStatId, facts: PipelineFacts): StatBreakdown {
  if (isSheetStat(stat)) {
    return SHEET_BUILDERS[stat](facts);
  }
  return FORMULA_BUILDERS[stat](facts);
}
