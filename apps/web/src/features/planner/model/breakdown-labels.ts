import {
  SHEET_PANEL_KEYS,
  type SheetKey,
  type SheetPanelKey,
} from '@bombfarm/domain/planner-constants';
import {
  buildStatBreakdown,
  LEDGER_SOURCE_GROUP,
  type BreakdownStatId,
  type LedgerSource,
  type PipelineFacts,
  type StatBreakdown,
} from '@bombfarm/domain/stat-breakdown';
import { sub, type Strings } from '@/shared/i18n';

// AC-21/DEC-06: Luck joins the pct set now that `statFull.luck` / `statShort.luck` exist
// (T5) and `isSheetKey` below is widened to cover it (T11) — renders at 2 dp with `%` on
// every SHEET_PANEL_KEYS surface.
export const SHEET_PCT_KEYS: ReadonlySet<SheetPanelKey> = new Set([
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
  'luck',
]);

export function derivedLabel(strings: Strings, statId: Exclude<BreakdownStatId, SheetKey>): string {
  switch (statId) {
    case 'mitF':
      return strings.effectiveMitF;
    case 'dmg':
      return strings.effectiveDmg;
    case 'hit':
      return strings.effectiveHit;
    case 'criticalHit':
      return strings.effectiveCriticalHit;
    case 'critFactor':
      return strings.effectiveCritFactor;
    case 'fuse':
      return strings.effectiveFuse;
    case 'bombsPerSecond':
      return strings.effectiveBombsPerSec;
    case 'fieldSeconds':
      return strings.effectiveField;
    case 'rest':
      return strings.effectiveRest;
    case 'uptime':
      return strings.effectiveUptime;
    case 'activeDps':
      return strings.effectiveActiveDps;
    case 'sustainedDps':
      return strings.effectiveSustainedDps;
  }
}

/**
 * `SHEET_PANEL_KEYS`-scoped (8, incl. `luck` — `DEC-06`, `AC-19`). `t.statFull` / `t.statShort`
 * have carried a `luck` entry since Wave 6's i18n task (T5), so every `SheetPanelKey` has a
 * label; `rowValue` still special-cases `luck` ahead of this guard because `facts.effective`
 * (`HeroSheet`) has no `luck` field to index (`AD-BSP-20`).
 */
export function isSheetKey(statId: BreakdownStatId): statId is SheetPanelKey {
  return (SHEET_PANEL_KEYS as readonly string[]).includes(statId);
}

export function formatBreakdownValue(
  statId: BreakdownStatId,
  value: number,
  formatNumber: (n: number, d?: number) => string,
): string {
  if (statId === 'mitF') return `×${formatNumber(value, 4)}`;
  if (statId === 'dmg' || statId === 'critFactor') return `×${formatNumber(value, 3)}`;
  if (statId === 'hit' || statId === 'criticalHit') return formatNumber(value, 0);
  if (statId === 'fuse') return `${formatNumber(value, 2)}s`;
  if (statId === 'fieldSeconds') return `${formatNumber(value, 0)}s (${formatNumber(value / 60, 1)}m)`;
  if (statId === 'rest') return `${formatNumber(value, 1)}m`;
  if (statId === 'bombsPerSecond') return `${formatNumber(value, 2)}/s`;
  if (statId === 'uptime') return `${formatNumber(value, 1)}%`;
  if (statId === 'activeDps' || statId === 'sustainedDps') return formatNumber(value, 0);
  // BSP-29/AC-25: sheet magnitudes at 2 dp — the Effective panel's sheet group and the
  // breakdown registry.
  if (isSheetKey(statId)) {
    return `${formatNumber(value, 2)}${SHEET_PCT_KEYS.has(statId) ? '%' : ''}`;
  }
  return formatNumber(value, 1);
}

export function rowValue(statId: BreakdownStatId, facts: PipelineFacts): number {
  // Luck has no HeroSheet field (AD-BSP-20) — its row resolves from `adjusted.luck` (DEC-06).
  if (statId === 'luck') return facts.adjusted.luck;
  if (isSheetKey(statId)) return facts.effective[statId];
  const breakdown = buildStatBreakdown(statId, facts);
  return breakdown.kind === 'formula' ? breakdown.value : 0;
}

export function sourceLabel(strings: Strings, source: LedgerSource): string {
  switch (source) {
    case 'base':
      return strings.bdSrcBase;
    case 'level':
      return strings.bdSrcLevel;
    case 'stars':
      return strings.bdSrcStars;
    case 'sheetAbilities':
      return strings.bdSrcSheetAbilities;
    case 'gear':
      return strings.bdSrcGear;
    case 'points':
      return strings.bdSrcPoints;
    case 'tree':
      return strings.bdSrcTree;
    case 'abilities':
      return strings.bdSrcAbilities;
    case 'team':
      return strings.bdSrcTeam;
    case 'abilitiesTeam':
      return strings.bdSrcAbilitiesTeam;
  }
}

/**
 * `BSP-20`/`AC-29` — names each ledger step's GAME line (Hero / Gear / Ability / Skill tree),
 * not its raw `LedgerSource`. `LEDGER_SOURCE_GROUP` (`DEC-07`) folds `base`/`level`/`stars`/
 * `points` into Hero, `sheetAbilities` into Ability, `gear`/`tree` stay themselves. The
 * `combat` group (`abilities`/`team`/`abilitiesTeam`) is deliberately NOT one of the four game
 * lines (`DEC-07`) — those steps keep their existing, more specific `sourceLabel` copy rather
 * than being folded into a generic fifth label.
 */
export function groupLabel(strings: Strings, source: LedgerSource): string {
  const group = LEDGER_SOURCE_GROUP[source];
  switch (group) {
    case 'hero':
      return strings.bdSrcHero;
    case 'gear':
      return strings.bdSrcGear;
    case 'ability':
      return strings.bdSrcAbility;
    case 'skillTree':
      return strings.bdSrcTree;
    case 'combat':
      return sourceLabel(strings, source);
  }
}

export function ledgerStepNote(
  strings: Strings,
  formatNumber: (n: number, d?: number) => string,
  step: Extract<StatBreakdown, { kind: 'ledger' }>['steps'][number],
): string | null {
  if (step.note === 'capped') return strings.bdNoteCapped;
  if (step.note === 'glassCannon') return strings.bdNoteGlassCannon;
  if (step.note === 'tempoDobrado') return strings.bdNoteTempoDobrado;
  if (step.note === 'ownTeamSplit') {
    return sub(strings.bdNoteSplit, {
      own: formatNumber(step.splitOwn ?? 0, 0),
      team: formatNumber(step.splitTeam ?? 0, 0),
    });
  }
  if (step.note === 'keenEye') return strings.bdNoteKeenEye;
  if (step.note === 'diamondTip') return strings.bdNoteDiamondTip;
  return null;
}
