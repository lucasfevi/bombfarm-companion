import type { SheetKey } from '@bombfarm/domain/planner-constants';

/**
 * What the sheet, points, next-point and stat-breakdown panels print: stat names, the peeled-sheet
 * column headings, the points table's counters and step labels, the Optimize-build controls and
 * their result notices, the next-point ranking's heading and its two farm-unavailable notes, and
 * the breakdown's source and note vocabulary.
 *
 * Host-supplied, in the same idiom as `RosterCopy`: no values live here, and a host passes
 * the flat dictionary it already has. Every one of these is vocabulary a host already prints —
 * "Attack", "Reset", "Crit Chance" head half its other screens — so copying them into this
 * package's own dictionary would give each string two owners that nothing keeps in sync.
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
  colSheetDeltaRune: string;
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

  metricNextPoint: string;
  rankFarmNoPool: string;
  rankFarmNoRate: string;
  rankFarmAddedToPool: string;

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

  panelEffective: string;
  effectiveTip: string;
  effectiveMitF: string;
  effectiveDmg: string;
  effectiveHit: string;
  effectiveCriticalHit: string;
  effectiveAvgHit: string;
  effectiveCritFactor: string;
  effectiveFuse: string;
  effectiveBombsPerSec: string;
  effectiveField: string;
  effectiveRest: string;
  effectiveUptime: string;
  effectiveActiveDps: string;
  effectiveSustainedDps: string;

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
  bdSrcRune: string;
  bdSrcHero: string;
  bdSrcAbility: string;
  bdNoteCapped: string;
  bdNoteSplit: string;
  bdNoteKeenEye: string;
  bdNoteDiamondTip: string;
  bdNoteBrutalStrike: string;
  /** `{hours}` — play hours left on the rune that expires first. */
  bdNoteRune: string;
};
