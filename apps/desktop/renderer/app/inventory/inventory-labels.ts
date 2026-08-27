import type { InventoryBadge, InventoryEquippedBy, InventoryGridLabels } from '@bombfarm/game-art';
import type { InventoryHero, InventoryViewItem, ItemKind } from '@bombfarm/domain/inventory-view';
import type { Copy } from '../../lib/copy';

const GROUP_KEY: Record<ItemKind, keyof Copy> = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  material: 'inventoryGroupMaterial',
  other: 'inventoryGroupOther',
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

function titleCase(token: string): string {
  return token.length === 0 ? token : token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Gear is named from its resolved set and slot; anything the item list cannot resolve keeps the
 * game's own identifier, which is the only name available for it until the list catches up.
 */
function itemName(item: InventoryViewItem, t: Copy): string {
  if (!item.defResolved || !item.slot) return item.defId;
  return fill(t.inventoryDetailSetSlot, { set: titleCase(item.set), slot: titleCase(item.slot) });
}

function itemDetail(item: InventoryViewItem, t: Copy): string {
  const parts = [fill(t.inventoryDetailLevel, { level: item.level })];
  if (item.sellValueGold > 0) {
    parts.push(fill(t.inventoryDetailSellValue, { gold: item.sellValueGold.toLocaleString('en-US') }));
  }
  return parts.join(' · ');
}

function badges(item: InventoryViewItem, t: Copy): InventoryBadge[] {
  const list: InventoryBadge[] = [];
  if (item.inStash) list.push({ key: 'stash', label: t.inventoryBadgeStash });
  if (item.locked) list.push({ key: 'locked', label: t.inventoryBadgeLocked });
  if (item.marketBlocked) list.push({ key: 'market', label: t.inventoryBadgeMarketBlocked, tone: 'warn' });
  if (!item.defResolved) list.push({ key: 'unresolved', label: t.inventoryBadgeUnresolved, tone: 'warn' });
  return list;
}

/**
 * A hero the app has not read is still reported as equipping the item — the item plainly is worn,
 * and saying so beats dropping the line and making it look loose.
 */
function equippedBy(
  item: InventoryViewItem,
  heroes: ReadonlyMap<string, InventoryHero>,
  t: Copy,
): InventoryEquippedBy | null {
  if (!item.equippedBy) return null;

  const hero = heroes.get(item.equippedBy);
  if (!hero) {
    return { lead: t.inventoryEquippedByLead, hero: t.inventoryEquippedByUnknown, rarityIdx: -1 };
  }

  return {
    lead: t.inventoryEquippedByLead,
    hero: fill(t.inventoryEquippedByHero, { hero: hero.name, level: hero.level }),
    rarityIdx: hero.rarityIdx,
  };
}

export function inventoryLabels(
  t: Copy,
  heroes: ReadonlyMap<string, InventoryHero> = new Map(),
): InventoryGridLabels {
  return {
    groupTitle: (kind) => t[GROUP_KEY[kind]],
    itemName: (item) => itemName(item, t),
    itemDetail: (item) => itemDetail(item, t),
    badges: (item) => badges(item, t),
    equippedBy: (item) => equippedBy(item, heroes, t),
    unknownCategoryNote: (codes) => fill(t.inventoryUnknownCategory, { codes: codes.join(', ') }),
    skippedNote: (count) => fill(t.inventorySkipped, { count }),
    empty: { title: t.inventoryEmptyTitle, description: t.inventoryEmptyDescription },
  };
}
