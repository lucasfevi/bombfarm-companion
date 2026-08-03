// DPS model for BombFarm heroes, built from the live server formulas
// published on wiki.bombfarm.net (Combate + Heróis + Casa & Energia pages).
//
// Sustained (farming) DPS per hero:
//   activeDPS = dano_avg × bombas/s × blocos/bomba × eficiência_IA
//   dano_avg  = ataque × (1 − mitig × (1 − pen)) × (1 + critChance × critDmg)
//   bombas/s  = (0.3 + 0.12 × velocidade_grid) × sf
//   velocidade_grid = velocidade × 0.0386
//   sf        = 0.5 + 0.5 × (1 − 1/(1 + 0.15 × stamina)), stamina = 2 + 0.02 × energia
//   duty      = energia / (energia + rest)   [1 energy/sec drain; rest = house T]
//   DPS       = activeDPS × duty
//
// Cycle model (frame analysis of a 42s combat recording, 2026-07-20, corrected):
// blob-deduped tracking shows serial bombing — one live bomb per hero, the next
// plant lands 0.0–0.5s after the previous explosion (avg 6.7 concurrent bombs
// for 9 heroes; measured cycle ≈ fuse + ~0.15s). The wiki bombas/s formula
// predicts a slower cycle than measured and appears stale post-rebalance.
// Serial model: rate = 1/(ft + walkDelay), ft = 2 × (1 − cdr) floored at 0.6s
// ("piso de 30% do ciclo" — the 0.6s cluster in the fuse histogram sits exactly
// on that floor). Under this model CDR is a real throughput stat. The legacy
// wiki-formula mode is kept as a toggle for comparison.

// Public barrel for shared/domain/model — split by concern (W7). Every
// pre-split export is re-exported here so `@/shared/domain/model` keeps
// resolving to the same public surface (module-scope private helpers stay
// inside their concern module).

export type { RarityKey, BaseRoll } from '@/shared/domain/model/rarity-constants';
export { BASE_ROLLS, POINT_GAIN, STAT_CAPS } from '@/shared/domain/model/rarity-constants';

export { HOUSES, houseRestSeconds, splitHouseRest } from '@/shared/domain/model/house';

export type {
  HeroSheet,
  CycleModel,
  Context,
  StatKey,
  PointValue,
  PointBases,
  EffectiveDeltas,
  RankMode,
  RankOptions,
} from '@/shared/domain/model/types';
export { STAT_LABELS } from '@/shared/domain/model/types';

export {
  staminaFactor,
  FUSE_FLOOR,
  fuseSeconds,
  marginalFuseSeconds,
  bombsPerSecond,
  critFactor,
  mitigationFactor,
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
} from '@/shared/domain/model/combat';

export { rankNextPoint, energySwitchPoint } from '@/shared/domain/model/points-rank';

export type { BirthStats, TreeSheetTotals, ComposeSheetFromBirthInput } from '@/shared/domain/birth-sheet';
export {
  nakedFromBirth,
  applySkillTree,
  composeSheetFromBirth,
  sheetsFromBirth,
} from '@/shared/domain/birth-sheet';

export type { SourceLines, SheetSourceLines, PeelSheetSourcesInput } from '@/shared/domain/sheet-peel';
export { peelSheetSources } from '@/shared/domain/sheet-peel';

export type { SheetStageRow, SheetStageTable, PeelSheetStagesInput } from '@/shared/domain/sheet-stages';
export { peelSheetStages } from '@/shared/domain/sheet-stages';

export type {
  PointInferenceIssue,
  PointInferenceResult,
  InferSpentPointsInput,
} from '@/shared/domain/point-inference';
export { POINT_INFERENCE_EPS, inferSpentPoints } from '@/shared/domain/point-inference';

export type { UnmodelledTreeInput } from '@/shared/domain/tree-guards';
export { unmodelledTreeFindings } from '@/shared/domain/tree-guards';

export type { ReoptInput, ReoptResult } from '@/shared/domain/points-reopt';
export {
  REOPT_KEYS,
  REOPT_GATE_MAX_EVALUATIONS,
  REOPT_FULL_MAX_EVALUATIONS,
  REOPT_FULL_MAX_SWEEPS,
  REOPT_BLOCK_SIZES,
  REOPT_REFUND_ROUNDS,
  findGateCandidate,
  optimizeBuild,
} from '@/shared/domain/points-reopt';

export type { ResetAdviceInput } from '@/shared/domain/reset-advice';
export { RESET_RECOMMEND_DPS_PCT, RESET_GATE_EPSILON_PCT, shouldRecommendReset } from '@/shared/domain/reset-advice';

export type { AbilityEffect, AbilityDef, AbilityMods, Milestone } from '@/shared/domain/model/abilities';
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
} from '@/shared/domain/model/abilities';
