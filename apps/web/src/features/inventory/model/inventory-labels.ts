import type {
  InventoryBadge,
  InventoryEquippedBy,
  InventoryGridLabels,
} from '@bombfarm/game-art';
import type { InventoryViewItem, InventoryViewStat, ItemKind } from '@bombfarm/domain/inventory-view';
import { itemRarityLabel, itemStatLabel, setName, slotLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import type { HeroRecord } from '@/shared/lib/storage';

type Lang = ReturnType<typeof useAppLang>['lang'];

const GROUP_KEY: Record<ItemKind, keyof Strings> = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  time: 'inventoryGroupTime',
  stone: 'inventoryGroupStone',
  chest: 'inventoryGroupChest',
  other: 'inventoryGroupOther',
};

/**
 * `def_id`s are wire tokens (`ember_luva`) and the catalog's own set and slot tokens are
 * Portuguese, so gear is named through the shared bilingual maps rather than by title-casing the
 * slug — that is what used to print "Elmo" and "Bota" on the English planner.
 *
 * Everything else is named from the id's own tail, which is already the rarity or the stone
 * (`map_key_epico`, `gem_amethyst`): the kind heading above the card carries the noun, so the
 * card only has to say which one.
 */
function itemName(item: InventoryViewItem, strings: Strings, lang: Lang): string {
  if (item.kind === 'equipment') {
    if (!item.defResolved || !item.slot) return item.defId;
    return sub(strings.inventoryDetailSetSlot, {
      set: setName(item.set, lang),
      slot: slotLabel(item.slot, lang),
    });
  }

  const gem = GEM_KEY[item.defId];
  if (gem) return strings[gem] as string;
  if (item.kind === 'chest') return chestName(item.defId, strings);
  return itemRarityLabel(item.rarityIdx, lang);
}

const GEM_KEY: Record<string, keyof Strings> = {
  gem_amethyst: 'inventoryGemAmethyst',
  gem_aquamarine: 'inventoryGemAquamarine',
  gem_citrine: 'inventoryGemCitrine',
  gem_diamond: 'inventoryGemDiamond',
  gem_emerald: 'inventoryGemEmerald',
  gem_oceanite: 'inventoryGemOceanite',
  gem_roselite: 'inventoryGemRoselite',
  gem_ruby: 'inventoryGemRuby',
  gem_sapphire: 'inventoryGemSapphire',
  gem_topaz: 'inventoryGemTopaz',
};

/** `chest_item_90` is the level-90 item chest; `chest_key_3`/`chest_gem_2` name their contents. */
function chestName(defId: string, strings: Strings): string {
  const itemChest = /^chest_item_(\d+)$/.exec(defId);
  if (itemChest) return sub(strings.inventoryChestItem, { level: itemChest[1] });
  if (defId.startsWith('chest_gem')) return strings.inventoryChestGem;
  if (defId.startsWith('chest_key')) return strings.inventoryChestKey;
  if (defId.startsWith('chest_skill')) return strings.inventoryChestSkill;
  if (defId.startsWith('chest_time')) return strings.inventoryChestTime;
  return defId;
}

/**
 * Gear gets rarity, level and forge; nothing else has any of the three — a gem's `level` and
 * `upgrade` both arrive as 0 on the wire, so printing "Lv 0" was showing a field the game does
 * not give that item.
 *
 * A key, a house part and a skill stone have no name of their own beyond their tier, so
 * {@link itemName} already prints the rarity. Repeating it here read "Épico / Épico".
 */
function itemDetail(item: InventoryViewItem, strings: Strings, lang: Lang): string {
  if (NAMED_BY_RARITY.has(item.kind)) return '';

  const rarity = itemRarityLabel(item.rarityIdx, lang);
  if (item.kind !== 'equipment') return rarity;

  const parts = [rarity, sub(strings.inventoryDetailLevel, { level: item.level })];
  if (item.upgrade > 0) parts.push(`+${item.upgrade}`);
  return parts.join(' · ');
}

/** Kinds whose only distinguishing feature is their tier, so the tier IS the name. */
const NAMED_BY_RARITY = new Set<ItemKind>(['key', 'time', 'stone']);

/** `dmg` is an absolute number; every other roll is a fraction the game shows as a percent. */
function itemStat(stat: InventoryViewStat, lang: Lang): string {
  const label = stat.name ? itemStatLabel(stat.name, lang) : String(stat.code);
  if (stat.unit === 'flat') return `${label} +${formatNumber(stat.effective, 1)}`;
  return `${label} +${formatNumber(stat.effective * 100, 2)}%`;
}

function badges(item: InventoryViewItem, strings: Strings): InventoryBadge[] {
  const list: InventoryBadge[] = [];
  if (item.locked) list.push({ key: 'locked', label: strings.inventoryBadgeLocked });
  if (item.marketBlocked) list.push({ key: 'market', label: strings.inventoryBadgeMarketBlocked, tone: 'warn' });
  if (!item.defResolved && item.kind === 'other') {
    list.push({ key: 'unresolved', label: strings.inventoryBadgeUnresolved, tone: 'warn' });
  }
  return list;
}

/**
 * `equippedBy` is the save's own hero id, which is a roster entry's `sourceId`. A hero the roster
 * does not hold is still reported as equipping the item — the item plainly is, and saying so
 * beats dropping the line and making a worn item look loose.
 */
function equippedBy(
  item: InventoryViewItem,
  heroBySourceId: ReadonlyMap<string, HeroRecord>,
  strings: Strings,
): InventoryEquippedBy | null {
  if (!item.equippedBy) return null;

  const hero = heroBySourceId.get(item.equippedBy);
  if (!hero) return { text: strings.inventoryEquippedByUnknown, rarityIdx: -1 };

  return {
    text: sub(strings.inventoryEquippedByHero, { hero: hero.name, level: hero.level }),
    rarityIdx: RARITIES.indexOf(hero.rarity),
  };
}

/** Everything a card shows, joined — so a search for "glacier boots epic" narrows on all three. */
function searchText(item: InventoryViewItem, strings: Strings, lang: Lang): string {
  return [
    itemName(item, strings, lang),
    itemDetail(item, strings, lang),
    item.defId,
    item.set,
    item.slot ?? '',
  ].join(' ');
}

export function inventoryLabels(
  strings: Strings,
  lang: Lang,
  heroes: readonly HeroRecord[] = [],
): InventoryGridLabels {
  const heroBySourceId = new Map<string, HeroRecord>();
  for (const hero of heroes) {
    if (hero.sourceId) heroBySourceId.set(hero.sourceId, hero);
  }

  return {
    groupTitle: (kind) => strings[GROUP_KEY[kind]] as string,
    itemName: (item) => itemName(item, strings, lang),
    itemDetail: (item) => itemDetail(item, strings, lang),
    itemStat: (stat) => itemStat(stat, lang),
    badges: (item) => badges(item, strings),
    equippedBy: (item) => equippedBy(item, heroBySourceId, strings),
    gold: (amount) => formatNumber(amount, 0),
    searchText: (item) => searchText(item, strings, lang),
    toolbar: {
      searchPlaceholder: strings.inventorySearchPlaceholder,
      searchLabel: strings.inventorySearchLabel,
      allKinds: strings.inventoryFilterAll,
      rarity: (rarityIdx) => itemRarityLabel(rarityIdx, lang),
      equippedOnly: strings.inventoryFilterEquipped,
      clear: strings.inventoryFilterClear,
      resultCount: (shown, total) => sub(strings.inventoryFilterCount, { shown, total }),
      noMatches: strings.inventoryFilterNoMatches,
    },
    unknownCategoryNote: (codes) => sub(strings.inventoryUnknownCategory, { codes: codes.join(', ') }),
    skippedNote: (count) => sub(strings.inventorySkipped, { count }),
    empty: { title: strings.inventoryEmptyTitle, description: strings.inventoryEmptyBody },
  };
}
