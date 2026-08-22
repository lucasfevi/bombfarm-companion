// Public barrel for shared/domain/gear — split by concern (W7). Every
// pre-split export is re-exported here so `@/shared/domain/gear` keeps
// resolving to the same public surface (module-scope private helpers stay
// inside their concern module).

export type {
  Slot,
  ItemStat,
  ItemRarityIdx,
  EquippedItem,
  Loadout,
  SheetStats,
  GearBonuses,
  ScaledValor,
  SheetOtherPct,
  PointAlloc,
  HeroSheetRescale,
} from './types';

export {
  FORJA_BONUS,
  FORJA_MAX,
  FORJA_LEVELS,
  SLOTS,
  ITEM_LEVELS,
  ITEM_RARITIES,
  SETS_BY_LEVEL,
  composeAttack,
  decomposeAttack,
  emptyLoadout,
  defsForSlot,
  setsForLevel,
  upgradeMult,
  itemLabel,
  scaledValores,
  sumGearBonuses,
  gearBonusDeltas,
  itemValores,
  emptySheetOther,
  starsMult,
  STAR_MULT_PER_STAR,
  MAX_STARS,
} from './catalog';

export {
  applyGear,
  reverseGear,
  projectGearedOntoLoadout,
  applyPoints,
  reverseSheet,
  emptySheet,
} from './apply';

export {
  defaultNaked,
  rescaleNakedForLevel,
  rescaleNakedPen,
  rescaleNakedCrit,
  rescaleNakedCritChance,
  rescaleNakedCritDmg,
  rescaleNakedForStars,
  rescaleCatalogApply,
  rescaleHeroForLevel,
  rescaleHeroForStars,
  nakedAfterSheetAbilityChange,
  canLevelUp,
  canStarUp,
  nextLevelStep,
  nextStarsStep,
} from './naked-rescale';
