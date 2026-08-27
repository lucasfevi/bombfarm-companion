import type { InventoryGridLabels, InventoryBadge, InventoryEquippedBy } from '@bombfarm/game-art';
import type { InventoryViewItem, ItemKind } from '@bombfarm/domain/inventory-view';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';
import type { HeroRecord } from '@/shared/lib/storage';

const GROUP_KEY: Record<ItemKind, keyof Strings> = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  material: 'inventoryGroupMaterial',
  other: 'inventoryGroupOther',
};

/**
 * `def_id`s are wire tokens (`ember_luva`), and the catalog's own set/slot names are Portuguese.
 * Gear is named from its resolved set and slot so it reads in the chosen locale; anything the
 * catalog cannot resolve keeps its raw `def_id`, which is the only honest name available for it.
 */
function itemName(item: InventoryViewItem, strings: Strings): string {
  if (!item.defResolved || !item.slot) return item.defId;
  return sub(strings.inventoryDetailSetSlot, { set: titleCase(item.set), slot: titleCase(item.slot) });
}

function titleCase(token: string): string {
  if (token.length === 0) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function itemDetail(item: InventoryViewItem, strings: Strings): string {
  const parts = [sub(strings.inventoryDetailLevel, { level: item.level })];
  if (item.sellValueGold > 0) {
    parts.push(sub(strings.inventoryDetailSellValue, { gold: formatNumber(item.sellValueGold, 0) }));
  }
  return parts.join(' · ');
}

function badges(item: InventoryViewItem, strings: Strings): InventoryBadge[] {
  const list: InventoryBadge[] = [];
  if (item.inStash) list.push({ key: 'stash', label: strings.inventoryBadgeStash });
  if (item.locked) list.push({ key: 'locked', label: strings.inventoryBadgeLocked });
  if (item.marketBlocked) list.push({ key: 'market', label: strings.inventoryBadgeMarketBlocked, tone: 'warn' });
  if (!item.defResolved) list.push({ key: 'unresolved', label: strings.inventoryBadgeUnresolved, tone: 'warn' });
  return list;
}

/**
 * `equippedBy` is the save's own hero id, which is a roster entry's `sourceId`. A hero the roster
 * does not hold is still reported as equipped — the item plainly is, and saying so beats dropping
 * the line and making a worn item look loose.
 */
function equippedBy(
  item: InventoryViewItem,
  heroBySourceId: ReadonlyMap<string, HeroRecord>,
  strings: Strings,
): InventoryEquippedBy | null {
  if (!item.equippedBy) return null;

  const hero = heroBySourceId.get(item.equippedBy);
  if (!hero) {
    return { lead: strings.inventoryEquippedByLead, hero: strings.inventoryEquippedByUnknown, rarityIdx: -1 };
  }

  return {
    lead: strings.inventoryEquippedByLead,
    hero: sub(strings.inventoryEquippedByHero, { hero: hero.name, level: hero.level }),
    rarityIdx: RARITIES.indexOf(hero.rarity),
  };
}

export function inventoryLabels(strings: Strings, heroes: readonly HeroRecord[] = []): InventoryGridLabels {
  const heroBySourceId = new Map<string, HeroRecord>();
  for (const hero of heroes) {
    if (hero.sourceId) heroBySourceId.set(hero.sourceId, hero);
  }

  return {
    groupTitle: (kind) => strings[GROUP_KEY[kind]] as string,
    itemName: (item) => itemName(item, strings),
    itemDetail: (item) => itemDetail(item, strings),
    badges: (item) => badges(item, strings),
    equippedBy: (item) => equippedBy(item, heroBySourceId, strings),
    unknownCategoryNote: (codes) => sub(strings.inventoryUnknownCategory, { codes: codes.join(', ') }),
    skippedNote: (count) => sub(strings.inventorySkipped, { count }),
    empty: { title: strings.inventoryEmptyTitle, description: strings.inventoryEmptyBody },
  };
}
