import type { InventoryBadge, InventoryEquippedBy, InventoryGridLabels } from '@bombfarm/game-art';
import type {
  InventoryHero,
  InventoryViewItem,
  InventoryViewStat,
  ItemKind,
} from '@bombfarm/domain/inventory-view';
import { itemRarityLabel, itemStatLabel, setName, slotLabel } from '@bombfarm/domain/game-labels';
import type { Copy } from '../../lib/copy';

const GROUP_KEY: Record<ItemKind, keyof Copy> = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  time: 'inventoryGroupTime',
  stone: 'inventoryGroupStone',
  chest: 'inventoryGroupChest',
  other: 'inventoryGroupOther',
};

const GEM_KEY: Record<string, keyof Copy> = {
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

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

/** `chest_item_90` is the level-90 item chest; `chest_key_3`/`chest_gem_2` name their contents. */
function chestName(defId: string, t: Copy): string {
  const itemChest = /^chest_item_(\d+)$/.exec(defId);
  if (itemChest) return fill(t.inventoryChestItem, { level: itemChest[1] });
  if (defId.startsWith('chest_gem')) return t.inventoryChestGem;
  if (defId.startsWith('chest_key')) return t.inventoryChestKey;
  if (defId.startsWith('chest_skill')) return t.inventoryChestSkill;
  if (defId.startsWith('chest_time')) return t.inventoryChestTime;
  return defId;
}

/**
 * Gear is named through the shared bilingual set and slot maps rather than by title-casing the
 * wire token, which is what used to print the Portuguese slot name on the English shell.
 * Everything else is named from the id's own tail — the kind heading carries the noun.
 */
function itemName(item: InventoryViewItem, t: Copy, lang: 'pt' | 'en'): string {
  if (item.kind === 'equipment') {
    if (!item.defResolved || !item.slot) return item.defId;
    return fill(t.inventoryDetailSetSlot, {
      set: setName(item.set, lang),
      slot: slotLabel(item.slot, lang),
    });
  }

  const gem = GEM_KEY[item.defId];
  if (gem) return t[gem];
  if (item.kind === 'chest') return chestName(item.defId, t);
  return itemRarityLabel(item.rarityIdx, lang);
}

/** Kinds whose only distinguishing feature is their tier, so the tier IS the name. */
const NAMED_BY_RARITY = new Set<ItemKind>(['key', 'time', 'stone']);

/**
 * Only gear has a level and a forge; everything else arrives with both at 0 on the wire. A key,
 * a house part and a skill stone are already named by their tier, so repeating it here read
 * "Epic / Epic".
 */
function itemDetail(item: InventoryViewItem, t: Copy, lang: 'pt' | 'en'): string {
  if (NAMED_BY_RARITY.has(item.kind)) return '';

  const rarity = itemRarityLabel(item.rarityIdx, lang);
  if (item.kind !== 'equipment') return rarity;

  const parts = [rarity, fill(t.inventoryDetailLevel, { level: item.level })];
  if (item.upgrade > 0) parts.push('+' + String(item.upgrade));
  return parts.join(' · ');
}

function number(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** `dmg` is an absolute number; every other roll is a fraction the game shows as a percent. */
function itemStat(stat: InventoryViewStat, lang: 'pt' | 'en'): string {
  const label = stat.name ? itemStatLabel(stat.name, lang) : String(stat.code);
  if (stat.unit === 'flat') return `${label} +${number(stat.effective, 1)}`;
  return `${label} +${number(stat.effective * 100, 2)}%`;
}

function badges(item: InventoryViewItem, t: Copy): InventoryBadge[] {
  const list: InventoryBadge[] = [];
  if (item.locked) list.push({ key: 'locked', label: t.inventoryBadgeLocked });
  if (item.marketBlocked) list.push({ key: 'market', label: t.inventoryBadgeMarketBlocked, tone: 'warn' });
  if (!item.defResolved && item.kind === 'other') {
    list.push({ key: 'unresolved', label: t.inventoryBadgeUnresolved, tone: 'warn' });
  }
  return list;
}

/**
 * A hero the app has not read is still reported as equipping the item — the item plainly is
 * worn, and dropping the line would make it look loose.
 */
function equippedBy(
  item: InventoryViewItem,
  heroes: ReadonlyMap<string, InventoryHero>,
  t: Copy,
): InventoryEquippedBy | null {
  if (!item.equippedBy) return null;

  const hero = heroes.get(item.equippedBy);
  if (!hero) return { text: t.inventoryEquippedByUnknown, rarityIdx: -1 };

  return {
    text: fill(t.inventoryEquippedByHero, { hero: hero.name, level: hero.level }),
    rarityIdx: hero.rarityIdx,
  };
}

/** Everything a card shows, joined — so a search for "glacier boots epic" narrows on all three. */
function searchText(item: InventoryViewItem, t: Copy, lang: 'pt' | 'en'): string {
  return [itemName(item, t, lang), itemDetail(item, t, lang), item.defId, item.set, item.slot ?? ''].join(' ');
}

export function inventoryLabels(
  t: Copy,
  lang: 'pt' | 'en',
  heroes: ReadonlyMap<string, InventoryHero> = new Map(),
): InventoryGridLabels {
  return {
    groupTitle: (kind) => t[GROUP_KEY[kind]],
    itemName: (item) => itemName(item, t, lang),
    itemDetail: (item) => itemDetail(item, t, lang),
    itemStat: (stat) => itemStat(stat, lang),
    badges: (item) => badges(item, t),
    equippedBy: (item) => equippedBy(item, heroes, t),
    gold: (amount) => number(amount, 0),
    searchText: (item) => searchText(item, t, lang),
    toolbar: {
      searchPlaceholder: t.inventorySearchPlaceholder,
      searchLabel: t.inventorySearchLabel,
      allKinds: t.inventoryFilterAll,
      rarity: (rarityIdx) => itemRarityLabel(rarityIdx, lang),
      equippedOnly: t.inventoryFilterEquipped,
      clear: t.inventoryFilterClear,
      resultCount: (shown, total) => fill(t.inventoryFilterCount, { shown, total }),
      noMatches: t.inventoryFilterNoMatches,
    },
    unknownCategoryNote: (codes) => fill(t.inventoryUnknownCategory, { codes: codes.join(', ') }),
    skippedNote: (count) => fill(t.inventorySkipped, { count }),
    empty: { title: t.inventoryEmptyTitle, description: t.inventoryEmptyDescription },
  };
}
