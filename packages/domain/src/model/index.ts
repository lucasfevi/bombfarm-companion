// DPS model for BombFarm heroes, built from the live server formulas
// published on wiki.bombfarm.net (Combate + Heróis + Casa & Energia pages).
//
// Sustained (farming) DPS per hero:
//   activeDPS = dano_avg × bombas/s × blocos/bomba × eficiência_IA
//   dano_avg  = ataque × (1 − mitig × (1 − pen)) × (1 + critChance × critDmg)
//   bombas/s  = plants per field second over a clear of the band      (cadence.ts)
//               cycle = E[max(fuse + 0.47, hop / w + 0.58)]              (plant-cycle.ts)
//   fuse      = 2 × (1 − cdr) floored at 0.4s ("piso de 20% do ciclo" — the floor
//               lands exactly at the 80% CDR cap)
//   w         = velocidade × 0.0386 cells/s; hop from the band's standing props,
//               scaled by speed and spread by a measured shape
//   duty      = energia / (energia + rest)   [1 energy/sec drain; rest = house T]
//   DPS       = activeDPS × duty
//
// One cadence model serves every DPS figure — the advisor, the next-point
// ranking, the team-plan scorer and the phase-farm board. The wiki's
// `(0.3 + 0.12 × velocidade_grid) × sf` rate and the later serial
// `1 / (fuse + walk)` model are both retired (apps/web/docs/adr/016).

// Public barrel for shared/domain/model — split by concern. Every
// pre-split export is re-exported here so `@/shared/domain/model` keeps
// resolving to the same public surface (module-scope private helpers stay
// inside their concern module).

export type { RarityKey, BaseRoll } from './rarity-constants';
export { BASE_ROLLS, POINT_GAIN, STAT_CAPS } from './rarity-constants';

export {
  HOUSES,
  HOUSE_MAX_LEVEL,
  houseRestSeconds,
  resolveHouseRestSeconds,
  splitHouseRest,
} from './house';

export type {
  HeroSheet,
  Context,
  StatKey,
  RankStatKey,
  PointValue,
  PointBases,
  EffectiveDeltas,
  RankMode,
  RankOptions,
} from './types';
export { STAT_LABELS } from './types';

export {
  FUSE_FLOOR,
  fuseSeconds,
  marginalFuseSeconds,
  bombsPerSecond,
  critFactor,
  readCritChance,
  mitigationFactor,
  HERO_MAX_LEVEL,
  levelPowerMult,
  attackPointGain,
  clampCritChancePct,
  clampCdrPct,
  clampPenPct,
  predictHitDamage,
  fieldSeconds,
  fieldPresence,
  fieldTimeInWindow,
  windowedDamage,
  sustainedDps,
  activeDps,
  gateDamage,
  GRID_SPEED_COEF,
  EFF_IA,
  BASE_BLAST_RANGE,
  damageWeightedBlastRange,
  blastDamageSpread,
} from './combat';

export {
  FIRST_ATO,
  REFERENCE_FIELD_HEROES,
  REFERENCE_BLAST_CELLS,
  REFERENCE_HITS_TO_KILL,
  cycleSecondsForHero,
} from './cadence';
export {
  FUSE_CYCLE_OVERHEAD_SEC,
  WALK_CYCLE_OVERHEAD_SEC,
  FREE_HOP_BASE_CELLS,
  FREE_HOP_SQRT_CELLS,
  FREE_HOP_SHAPE,
  HOP_SPEED_EXPONENT,
  HOP_SPEED_PIVOT,
  REPLANT_HOP_CELLS,
  REPLANT_SHARE,
  freeHopCells,
  hopSpeedFactor,
  plantCycleSeconds,
  meanPlantCycleSeconds,
} from './plant-cycle';

export { rankNextPoint, energySwitchPoint, RANK_STATS } from './points-rank';

export type {
  PassagemBastaoCarrier,
  PassagemBastaoFieldPulse,
  PassagemBastaoLevel,
} from './passagem-bastao';
export {
  PASSAGEM_BASTAO_PER_RANK,
  PASSAGEM_BASTAO_WINDOW_SEC,
  PASSAGEM_BASTAO_COOLDOWN_SEC,
  PASSAGEM_BASTAO_CAP,
  PASSAGEM_BASTAO_CAPPED_PULSE,
  passagemBastaoPresence,
  passagemBastaoWindowPresence,
  passagemBastaoFieldPulse,
} from './passagem-bastao';

export { MATILHA_PER_RANK_PER_ALLY, MATILHA_CAP, matilhaMult, alliesOverRotation } from './matilha';

export type { BirthStats, TreeSheetTotals, ComposeSheetFromBirthInput } from '../birth-sheet';
export type { Collection, CollectionSheetPct } from '../collection';
export {
  NO_COLLECTION,
  collectionFromSave,
  collectionGoldMult,
  collectionKey,
  collectionLuckPct,
  collectionSheetPct,
  normalizeCollection,
} from '../collection';
export type {
  CollectionAxisRow,
  CollectionBagItem,
  CollectionBoard,
  CollectionBoardSummary,
  CollectionPageEffect,
  CollectionPageRow,
  CollectionPieceRow,
  CollectionSetEffectRow,
  CollectionSetRow,
  CollectionSetStatus,
} from '../collection-board';
export {
  COLLECTION_PAGES,
  COLLECTION_PIECES_PER_PAGE,
  buildCollectionBoard,
  collectionBagItemsFromInventory,
  collectionCents,
  collectionPageGrantCents,
  collectionPageIncrementsCents,
} from '../collection-board';
export {
  nakedFromBirth,
  applySkillTree,
  composeSheetFromBirth,
  sheetsFromBirth,
} from '../birth-sheet';

export type { SourceLines, SheetSourceLines, PeelSheetSourcesInput } from '../sheet-peel';
export { peelSheetSources } from '../sheet-peel';

export type { SheetStageRow, SheetStageTable, PeelSheetStagesInput } from '../sheet-stages';
export { peelSheetStages } from '../sheet-stages';

export { gameSheetView, capSheetValue } from '../sheet-view';

export type {
  PointInferenceIssue,
  PointInferenceResult,
  InferSpentPointsInput,
} from '../point-inference';
export { POINT_INFERENCE_EPS, inferSpentPoints } from '../point-inference';

export type { ReoptInput, ReoptResult } from '../points-reopt';
export {
  REOPT_KEYS,
  REOPT_GATE_MAX_EVALUATIONS,
  REOPT_FULL_MAX_EVALUATIONS,
  REOPT_FULL_MAX_SWEEPS,
  REOPT_BLOCK_SIZES,
  REOPT_REFUND_ROUNDS,
  findGateCandidate,
  optimizeBuild,
} from '../points-reopt';

export type { ResetAdviceInput } from '../reset-advice';
export { RESET_RECOMMEND_DPS_PCT, RESET_GATE_EPSILON_PCT, shouldRecommendReset } from '../reset-advice';

export type { AbilityEffect, AbilityDef, AbilityMods, Milestone } from './abilities';
export {
  ABILITIES,
  isSheetAbility,
  SHEET_ABILITIES,
  COMBAT_ABILITIES,
  ABILITY_QUOTA,
  ABILITY_LEVEL_MAX,
  abilityPointBudget,
  abilityMods,
  critMilestones,
  wholeRangeCells,
} from './abilities';
