import type { SheetKey } from '@bombfarm/domain/planner-constants';

/**
 * What the sheet, points and stat-breakdown panels print: stat names, the peeled-sheet column
 * headings, the points table's counters and step labels, the Optimize-build controls and their
 * result notices, and the breakdown's source, note, term and formula vocabulary.
 *
 * Host-supplied, in the same idiom as `RosterCopy`: no values live here, and a host passes
 * the flat dictionary it already has. Every one of these is vocabulary a host already prints —
 * "Attack", "Reset", "Crit Chance" head half its other screens — so copying them into this
 * package's own dictionary would give each string two owners that nothing keeps in sync.
 *
 * The `bdFormula*` and `bdTerm*` members are looked up by key at runtime (a breakdown carries its
 * own `expressionKey`, and the glossary maps a token to a `tipKey`), so they are listed here
 * individually rather than reached through an index signature that would make every one optional.
 */
export type StatPanelCopy = {
  statFull: Record<SheetKey, string>;
  statShort: Record<SheetKey, string>;

  fieldRequired: string;
  colStat: string;

  panelSheet: string;
  sheetTip: string;
  sheetTipNeedBirth: string;
  colSheetBirth: string;
  colSheetDeltaLevel: string;
  colSheetDeltaStars: string;
  colSheetDeltaAbility: string;
  colSheetDeltaGear: string;
  colSheetDeltaPoints: string;
  colSheetDeltaTree: string;
  colSheetTotal: string;
  colSheetOverCap: string;

  panelPoints: string;
  abilitiesSpent: string;
  pointsUnspentBanked: string;
  pointsOverBudgetWarning: string;
  pointsStepMinusFiveAria: string;
  pointsStepPlusFiveAria: string;
  reset: string;
  resetAdviceGainLine: string;
  colPerPt: string;
  colAfter: string;
  colPreview: string;

  modeDps: string;
  modeFarm: string;
  optimizeModeLabel: string;
  optimizeBuildButton: string;
  optimizeBuildNoBudgetReason: string;
  optimizeBuildBudgetExhausted: string;
  optimizeBuildHeroDisabledNote: string;
  optimizeBuildKeptCurrent: string;
  optimizeBuildResultLine: string;
  optimizeBuildFarmKeptCurrent: string;
  optimizeBuildFarmResultLine: string;
  optimizeBuildFarmNoPool: string;
  optimizeBuildFarmNoRate: string;
  previewApplyButton: string;
  previewClearButton: string;
  previewRespecNote: string;

  effectiveMitF: string;
  effectiveDmg: string;
  effectiveHit: string;
  effectiveCriticalHit: string;
  effectiveCritFactor: string;
  effectiveFuse: string;
  effectiveBombsPerSec: string;
  effectiveField: string;
  effectiveRest: string;
  effectiveUptime: string;
  effectiveActiveDps: string;
  effectiveSustainedDps: string;

  bdLedgerTotal: string;
  bdSrcBase: string;
  bdSrcLevel: string;
  bdSrcStars: string;
  bdSrcSheetAbilities: string;
  bdSrcGear: string;
  bdSrcPoints: string;
  bdSrcTree: string;
  bdSrcAbilities: string;
  bdSrcTeam: string;
  bdSrcAbilitiesTeam: string;
  bdSrcHero: string;
  bdSrcAbility: string;
  bdNoteCapped: string;
  bdNoteSplit: string;
  bdNoteKeenEye: string;
  bdNoteDiamondTip: string;
  bdNoteBrutalStrike: string;

  bdFormulaMitF: string;
  bdFormulaDmg: string;
  bdFormulaHit: string;
  bdFormulaCriticalHit: string;
  bdFormulaCritFactor: string;
  bdFormulaFuse: string;
  bdFormulaBombsSerial: string;
  bdFormulaBombsWiki: string;
  bdFormulaField: string;
  bdFormulaRest: string;
  bdFormulaUptime: string;
  bdFormulaActive: string;
  bdFormulaSustained: string;

  bdTermMit: string;
  bdTermPen: string;
  bdTermAbl: string;
  bdTermExtra: string;
  bdTermAtk: string;
  bdTermMitigation: string;
  bdTermDamage: string;
  bdTermCd: string;
  bdTermCc: string;
  bdTermCdr: string;
  bdTermWalk: string;
  bdTermSf: string;
  bdTermDrain: string;
  bdTermRestSeconds: string;
  bdTermField: string;
  bdTermRestSecs: string;
  bdTermAvg: string;
  bdTermRange: string;
  bdTermActiveDps: string;
};
