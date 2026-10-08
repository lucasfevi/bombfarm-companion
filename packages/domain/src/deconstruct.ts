import type { InventoryViewItem } from './inventory-view';

/** The game client's own per-call burn cap (Steam build 25733721); the server may lower it and
 *  refuses a batch over its limit. */
export const DECONSTRUCT_BATCH_MAX = 100;

/** The client asks for a second confirmation when a batch holds a piece of this rarity or above
 *  (Epic), measured from the client's own constant (Steam build 25733721). */
export const DECONSTRUCT_WARN_RARITY = 3;

/** The client's autofill only picks pieces below this rarity (Uncommon and under), measured from
 *  its own constant (Steam build 25733721). */
export const DECONSTRUCT_FILL_BELOW_RARITY = 2;

export type DeconstructBlockReason =
  | 'not_burnable'
  | 'equipped'
  | 'locked'
  | 'market'
  | 'has_gems'
  | 'import_cooldown';

export type DeconstructRefusalReason = DeconstructBlockReason | 'batch_too_big' | 'missing_item';

export type DeconstructBatchSummary = {
  count: number;
  essence: number;
  /** Items with a forge level above zero. */
  forged: number;
  /** Items at or above {@link DECONSTRUCT_WARN_RARITY}. */
  rare: number;
};

const REFUSAL_BY_CODE: ReadonlyMap<string, DeconstructRefusalReason> = new Map([
  ['ITEM_EQUIPPED', 'equipped'],
  ['ITEM_USER_LOCKED', 'locked'],
  ['ITEM_LOCKED', 'market'],
  ['ITEM_HAS_GEMS', 'has_gems'],
  ['ITEM_IMPORT_COOLDOWN', 'import_cooldown'],
  ['ITEM_NOT_BURNABLE', 'not_burnable'],
  ['BURN_BATCH_TOO_BIG', 'batch_too_big'],
  ['NO_SUCH_ITEM', 'missing_item'],
]);

/** What a server refusal code means, or `null` for a code the client has no handling for. */
export function deconstructRefusalReason(code: string): DeconstructRefusalReason | null {
  return REFUSAL_BY_CODE.get(code) ?? null;
}

function serverVerdictReason(reason: string): DeconstructBlockReason {
  const known = deconstructRefusalReason(reason);
  return known === null || known === 'batch_too_big' || known === 'missing_item' ? 'not_burnable' : known;
}

function worthBurning(item: InventoryViewItem): boolean {
  if (item.essenceValue === null) return item.kind === 'equipment';
  return item.essenceValue > 0;
}

/**
 * Why the game would not let this item be burned, checked in the order the client checks it, or
 * `null` when it would. A server verdict of `desconstruir: false` outranks every local check, and
 * keeps its own reason when that reason is one of the refusal codes the client knows.
 */
export function deconstructBlockReason(item: InventoryViewItem): DeconstructBlockReason | null {
  if (item.burnRefusal !== null) return serverVerdictReason(item.burnRefusal.reason);
  if (!worthBurning(item)) return 'not_burnable';
  if (item.equipped) return 'equipped';
  if (item.locked) return 'locked';
  if (item.marketBlocked) return 'market';
  if (item.hasGems) return 'has_gems';
  return null;
}

export function deconstructBatchSummary(items: readonly InventoryViewItem[]): DeconstructBatchSummary {
  let essence = 0;
  let forged = 0;
  let rare = 0;
  for (const item of items) {
    essence += item.essenceValue ?? 0;
    if (item.upgrade > 0) forged += 1;
    if (item.rarityIdx >= DECONSTRUCT_WARN_RARITY) rare += 1;
  }
  return { count: items.length, essence, forged, rare };
}

/** Item ids are digit strings of unbounded length, so shorter is smaller and equal lengths compare
 *  as text — numeric order without going through a lossy `Number`. */
function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The ids the game's autofill would add on top of what is already selected: burnable items below
 * {@link DECONSTRUCT_FILL_BELOW_RARITY}, lowest rarity then lowest level first, as many as fit
 * under `cap`. Chests and hero cages are never picked — they burn only when chosen explicitly,
 * though their low derived tiers would otherwise sweep them in. Ties on both fall to the lower id
 * so the answer never depends on list order.
 */
export function deconstructFillCandidates(
  items: readonly InventoryViewItem[],
  alreadySelectedIds: Iterable<string>,
  cap: number,
): string[] {
  const selected = new Set(alreadySelectedIds);
  const room = cap - selected.size;
  if (room <= 0) return [];

  return items
    .filter(
      (item) =>
        !selected.has(item.id) &&
        item.kind !== 'chest' &&
        item.rarityIdx < DECONSTRUCT_FILL_BELOW_RARITY &&
        deconstructBlockReason(item) === null,
    )
    .sort((a, b) => a.rarityIdx - b.rarityIdx || a.level - b.level || compareIds(a.id, b.id))
    .slice(0, room)
    .map((item) => item.id);
}
