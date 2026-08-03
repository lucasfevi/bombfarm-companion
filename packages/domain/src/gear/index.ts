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
  SheetOtherPct,
  PointAlloc,
  HeroSheetRescale,
} from '@/shared/domain/gear/types';

export {
  FORJA_BONUS,
  FORJA_MAX,
  FORJA_LEVELS,
  SLOTS,
  ITEM_LEVELS,
  ITEM_RARITIES,
  SETS_BY_LEVEL,
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
} from '@/shared/domain/gear/catalog';

export {
  applyGear,
  reverseGear,
  projectGearedOntoLoadout,
  applyPoints,
  reverseSheet,
  emptySheet,
} from '@/shared/domain/gear/apply';

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
} from '@/shared/domain/gear/naked-rescale';
