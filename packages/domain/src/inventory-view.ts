import catalog from './data/catalog.json';

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));
const rarityByIdx = new Map(catalog.rarities.map((rarity) => [rarity.idx, rarity]));
const statNames: readonly string[] = catalog.itemStats;

export type ItemKind = 'equipment' | 'gem' | 'key' | 'material' | 'other';

export const ITEM_KINDS: readonly ItemKind[] = ['equipment', 'gem', 'key', 'material', 'other'];

export type InventoryViewStat = {
  /** Catalog stat name (`dmg`, `sorte`, …); `null` when the wire's stat code is off the end of
   *  the catalog's `itemStats`, which is what a new stat looks like from here. */
  name: string | null;
  code: number;
  value: number;
  effective: number;
};

export type InventoryViewItem = {
  id: string;
  defId: string;
  kind: ItemKind;
  /** The wire's own `category` code, kept verbatim so an `other` row can be identified without
   *  re-reading a capture. `null` when the row carried no category at all. */
  categoryCode: number | null;
  set: string;
  rarityIdx: number;
  /** Stable catalog rarity code (`comum`, `raro`, …) for i18n lookup; `null` past the catalog's
   *  known rarities. Never a display string — the catalog's own labels are Portuguese. */
  rarityCode: string | null;
  slot: string | null;
  level: number;
  upgrade: number;
  power: number;
  sellValueGold: number;
  sellable: boolean;
  tradable: boolean;
  marketBlocked: boolean;
  locked: boolean;
  equipped: boolean;
  equippedBy: string | null;
  inStash: boolean;
  stats: InventoryViewStat[];
  defResolved: boolean;
};

export type InventoryGroup = {
  kind: ItemKind;
  items: InventoryViewItem[];
};

export type InventoryView = {
  items: InventoryViewItem[];
  groups: InventoryGroup[];
  /** Rows dropped for having no usable `id`/`def_id`. Surfaced rather than silently swallowed so
   *  a parse regression is visible in the UI instead of showing up as a short list. */
  skipped: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

const KIND_BY_DEF_PREFIX: readonly (readonly [string, ItemKind])[] = [
  ['gem_', 'gem'],
  ['map_key_', 'key'],
  ['time_part_', 'material'],
];

/**
 * Three sources, strongest first. `category: 0` is the one code corroborated against the catalog
 * — every category-0 row in the calibration capture resolves to a gear definition. The `def_id`
 * prefixes come next, since they name a kind explicitly. A `def_id` the catalog resolves is gear
 * by construction (the catalog holds the 240 gear definitions and nothing else), which is what
 * classifies a row that carries no `category` at all — the save-export shape does exactly that.
 *
 * Everything else lands in `other`. Defaulting an unrecognised row to `equipment` would file it
 * under a gear slot it does not have and hide the very rows worth looking at after a patch adds
 * an item type.
 */
export function resolveItemKind(categoryCode: number | null, defId: string): ItemKind {
  if (categoryCode === 0) return 'equipment';
  for (const [prefix, kind] of KIND_BY_DEF_PREFIX) {
    if (defId.startsWith(prefix)) return kind;
  }
  if (defById.has(defId)) return 'equipment';
  return 'other';
}

function mapStats(raw: unknown): InventoryViewStat[] {
  if (!Array.isArray(raw)) return [];
  const stats: InventoryViewStat[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const code = Math.round(asNumber(entry.stat ?? entry.code, -1));
    if (code < 0) continue;
    const value = asNumber(entry.value, 0);
    stats.push({
      name: statNames[code] ?? null,
      code,
      value,
      effective: asNumber(entry.effective, value),
    });
  }
  return stats;
}

/**
 * Maps one raw `/inventory` (or save export) row for display. Unlike `mapInventoryItem`, which
 * feeds the optimizer and keeps gear alone, this keeps every row and every field the wire sends
 * — the inventory view is the one surface that should show an item the planner cannot use.
 */
export function mapInventoryViewItem(raw: unknown): InventoryViewItem | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  const defId = asString(raw.def_id ?? raw.defId);
  if (!id || !defId) return null;

  // Every `??` below reaches for this function's OWN output key as a second source. A stored view
  // item is re-read through here on load, and the mapped shape spells none of the wire's names —
  // without the fallbacks a reloaded row comes back category-less, `comum`, worth zero gold and
  // with no stats, which is what the inventory grid was rendering.
  const rawCategory = raw.category ?? raw.categoryCode;
  const categoryCode =
    rawCategory === undefined || rawCategory === null ? null : Math.round(asNumber(rawCategory, Number.NaN));
  const category = categoryCode !== null && Number.isFinite(categoryCode) ? categoryCode : null;

  const definition = defById.get(defId);
  const equippedBy = asString(raw.equipped_on ?? raw.equippedBy);
  const rarityIdx = Math.round(asNumber(raw.rarity ?? raw.rarityIdx, 0));

  return {
    id,
    defId,
    kind: resolveItemKind(category, defId),
    categoryCode: category,
    set: asString(raw.set, definition?.set ?? ''),
    rarityIdx,
    rarityCode: rarityByIdx.get(rarityIdx)?.code ?? null,
    slot: definition?.slot ?? null,
    level: asNumber(raw.level, definition?.nativeLevel ?? 0),
    upgrade: Math.round(asNumber(raw.upgrade, 0)),
    power: asNumber(raw.power, 0),
    sellValueGold: asNumber(raw.sell_value ?? raw.sellValueGold, 0),
    sellable: raw.sellable !== false,
    tradable: raw.tradable === true,
    marketBlocked: raw.marketBlocked === true || Math.round(asNumber(raw.market_state, 0)) !== 0,
    locked: raw.locked === true,
    equipped: equippedBy.length > 0,
    equippedBy: equippedBy.length > 0 ? equippedBy : null,
    inStash: raw.in_stash === true || raw.inStash === true,
    stats: mapStats(raw.stats),
    defResolved: Boolean(definition),
  };
}

export type InventoryHero = {
  /** The save's own hero id — what an item's `equippedBy` holds. */
  id: string;
  name: string;
  rarityIdx: number;
  level: number;
};

/**
 * Hero identity alone, keyed by the save's own hero id. Deliberately not a roster parse: the
 * inventory surface needs a name to put on "equipped by", never a stat, and going through the
 * full candidate pipeline for four display fields would re-derive every sheet on the account.
 */
export function mapInventoryHeroes(rawHeroes: readonly unknown[] | undefined): Map<string, InventoryHero> {
  const byId = new Map<string, InventoryHero>();
  if (!Array.isArray(rawHeroes)) return byId;

  for (const raw of rawHeroes) {
    if (!isObject(raw)) continue;
    const id = asString(raw.id);
    if (!id) continue;
    byId.set(id, {
      id,
      name: asString(raw.name, id),
      rarityIdx: Math.round(asNumber(raw.rarity ?? raw.rarityIdx, 0)),
      level: asNumber(raw.level, 1),
    });
  }
  return byId;
}

export function groupInventoryByKind(items: readonly InventoryViewItem[]): InventoryGroup[] {
  const byKind = new Map<ItemKind, InventoryViewItem[]>();
  for (const item of items) {
    const bucket = byKind.get(item.kind);
    if (bucket) bucket.push(item);
    else byKind.set(item.kind, [item]);
  }
  return ITEM_KINDS.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    items: byKind.get(kind) ?? [],
  }));
}

/** Raw `/inventory` items (or a save export's `items[]`) to the grouped view both shells render. */
export function buildInventoryView(rawItems: readonly unknown[] | undefined): InventoryView {
  if (!Array.isArray(rawItems)) return { items: [], groups: [], skipped: 0 };

  const items: InventoryViewItem[] = [];
  let skipped = 0;
  for (const raw of rawItems) {
    const mapped = mapInventoryViewItem(raw);
    if (mapped) items.push(mapped);
    else skipped += 1;
  }

  return { items, groups: groupInventoryByKind(items), skipped };
}
