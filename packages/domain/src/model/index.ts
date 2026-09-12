// DPS model for BombFarm heroes, built from the live server formulas
// published on wiki.bombfarm.net (Combate + Heróis + Casa & Energia pages).
//
// Sustained (farming) DPS per hero:
//   activeDPS = dano_avg × bombas/s × blocos/bomba × eficiência_IA
//   dano_avg  = ataque × (1 − mitig × (1 − pen)) × (1 + critChance × critDmg)
//   bombas/s  = 1 / cycle,  cycle = E[max(fuse, hop / w)] + latency   (cadence.ts)
//   fuse      = 2 × (1 − cdr) floored at 0.4s ("piso de 20% do ciclo" — the floor
//               lands exactly at the 80% CDR cap)
//   w         = velocidade × 0.0386 cells/s; hop drawn from a measured histogram
//               rescaled to the phase's difficulty band
//   duty      = energia / (energia + rest)   [1 energy/sec drain; rest = house T]
//   DPS       = activeDPS × duty
//
// One cadence model serves every DPS figure — the advisor, the next-point
// ranking, the team-plan scorer and the phase-farm board. The wiki's
// `(0.3 + 0.12 × velocidade_grid) × sf` rate and the later serial
// `1 / (fuse + walk)` model are both retired (apps/web/docs/adr/016).

// Public barrel for shared/domain/model — split by concern (W7). Every
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
  mitigationFactor,
  HERO_MAX_LEVEL,
  levelPowerMult,
  attackPointGain,
  clampCritChancePct,
  clampCdrPct,
  clampPenPct,
  predictHitDamage,
  fieldSeconds,
  sustainedDps,
  activeDps,
  gateDamage,
  GRID_SPEED_COEF,
  EFF_IA,
} from './combat';

export {
  HOP_DISTRIBUTION,
  CYCLE_LATENCY_SEC,
  HOP1_CYCLE_SEC,
  HOP_FIT_ATO,
  HOP_DENSITY_EXPONENT,
  hopScaleForAto,
  cycleSecondsForHero,
} from './cadence';

export { rankNextPoint, energySwitchPoint, RANK_STATS } from './points-rank';

export type { BirthStats, TreeSheetTotals, ComposeSheetFromBirthInput } from '../birth-sheet';
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
} from './abilities';
