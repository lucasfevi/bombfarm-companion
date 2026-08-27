import catalog from './data/catalog.json';

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

/** Forge upgrade `+0…+15`: `mult = 1 + 0.08 × N` (wiki `itens.forja.bonus`). Duplicated from
 *  `gear/catalog.ts` rather than imported — that module pulls in the whole loadout model, and
 *  this one is loaded by the desktop's renderer for a display list. */
const FORGE_BONUS = 0.08;
const FORGE_MAX = 15;
const rarityByIdx = new Map(catalog.rarities.map((rarity) => [rarity.idx, rarity]));
const statNames: readonly string[] = catalog.itemStats;

export type ItemKind = 'equipment' | 'chest' | 'gem' | 'time' | 'key' | 'stone' | 'other';

export const ITEM_KINDS: readonly ItemKind[] = [
  'equipment',
  'gem',
  'key',
  'time',
  'stone',
  'chest',
  'other',
];

/**
 * The wire's `category` code → kind. Read off a 63-save corpus where the six codes partition
 * every one of 11,785 item rows with no overlap and no gaps: 0 gear, 1 chest, 2 gem, 3 time
 * part, 4 map key, 5 skill stone. This is the game's own classification, so it outranks both the
 * `def_id` prefix and the catalog lookup below.
 */
const KIND_BY_CATEGORY: Record<number, ItemKind> = {
  0: 'equipment',
  1: 'chest',
  2: 'gem',
  3: 'time',
  4: 'key',
  5: 'stone',
};

/** Only gear varies per instance (level, forge, rolled stats). Everything else is fungible, so a
 *  wall of 11 identical keys is one card carrying a count. */
export function isStackableKind(kind: ItemKind): boolean {
  return kind !== 'equipment';
}

/** `dmg` is an absolute number; every other item stat is a fraction to be shown as a percent. */
export type ItemStatUnit = 'flat' | 'pct';

export type InventoryViewStat = {
  /** Catalog stat name (`dmg`, `sorte`, …); `null` when the wire's stat code is off the end of
   *  the catalog's `itemStats`, which is what a new stat looks like from here. */
  name: string | null;
  code: number;
  unit: ItemStatUnit;
  /** The roll before the forge multiplier. */
  value: number;
  /** The roll with `+N` forge applied — the number the game shows on the item. */
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

/**
 * One card's worth of inventory. Gear is always `count: 1` — two swords with different forge
 * levels are different objects. Every other kind collapses to one entry per `def_id`, since the
 * rows are identical in everything a player can act on.
 */
export type InventoryEntry = {
  /** Stable across renders and across a reload: the item id for gear, the stack id otherwise. */
  key: string;
  /** The row itself for gear; the first row of the stack otherwise. */
  item: InventoryViewItem;
  count: number;
  /** Sell value of the whole entry — one item's worth for gear, the stack's total otherwise. */
  sellValueGold: number;
};

export type InventoryGroup = {
  kind: ItemKind;
  entries: InventoryEntry[];
  /** Rows behind this group, which is larger than `entries.length` wherever a stack collapsed. */
  count: number;
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
  ['time_part_', 'time'],
  ['skill_stone_', 'stone'],
  ['chest_', 'chest'],
];

/**
 * Three sources, strongest first. The wire's own `category` is authoritative and total — see
 * {@link KIND_BY_CATEGORY}. The `def_id` prefixes come next, since they name a kind explicitly
 * and are what classify a row that carries no `category` at all (the save-export shape). Last, a
 * `def_id` the catalog resolves is gear by construction, since the catalog holds the gear
 * definitions and nothing else.
 *
 * Everything else lands in `other`. Defaulting an unrecognised row to `equipment` would file it
 * under a gear slot it does not have and hide the very rows worth looking at after a patch adds
 * an item type.
 */
export function resolveItemKind(categoryCode: number | null, defId: string): ItemKind {
  if (categoryCode !== null) {
    const byCategory = KIND_BY_CATEGORY[categoryCode];
    if (byCategory) return byCategory;
  }
  for (const [prefix, kind] of KIND_BY_DEF_PREFIX) {
    if (defId.startsWith(prefix)) return kind;
  }
  if (defById.has(defId)) return 'equipment';
  return 'other';
}

function statUnit(name: string | null): ItemStatUnit {
  return name === 'dmg' ? 'flat' : 'pct';
}

function mapStats(raw: unknown): InventoryViewStat[] {
  if (!Array.isArray(raw)) return [];
  const stats: InventoryViewStat[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const code = Math.round(asNumber(entry.stat ?? entry.code, -1));
    if (code < 0) continue;
    const value = asNumber(entry.value, 0);
    const name = statNames[code] ?? null;
    stats.push({
      name,
      code,
      unit: statUnit(name),
      value,
      effective: asNumber(entry.effective, value),
    });
  }
  return stats;
}

/**
 * The rolls the catalog says a gear definition carries at this level and forge, in wire shape.
 * Only reached when a row arrives with no `stats` of its own — a save export always carries
 * them, and where both exist they agree exactly (checked across a capture: 346 of 346 stats
 * match `scaledValores` to floating-point tolerance), so this is a gap-filler and never a
 * second opinion.
 */
function catalogStats(defId: string, rarityIdx: number, level: number, upgrade: number): InventoryViewStat[] {
  const definition = defById.get(defId);
  if (!definition) return [];
  const nativeMult = (catalog.nivelMult as Record<string, number>)[String(definition.nativeLevel)] ?? 1;
  const itemMult = (catalog.nivelMult as Record<string, number>)[String(level)] ?? nativeMult;
  const forge = 1 + FORGE_BONUS * Math.max(0, Math.min(FORGE_MAX, Math.round(upgrade)));
  const scale = itemMult / nativeMult;
  const statCount = rarityByIdx.get(rarityIdx)?.statCount ?? 1;

  return definition.valores.slice(0, statCount).map((roll) => {
    const code = statNames.indexOf(roll.stat);
    const value = roll.valor * scale;
    return {
      name: roll.stat,
      code: code >= 0 ? code : -1,
      unit: statUnit(roll.stat),
      value,
      effective: value * forge,
    };
  });
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
  const level = asNumber(raw.level, definition?.nativeLevel ?? 0);
  const upgrade = Math.round(asNumber(raw.upgrade, 0));
  const stats = mapStats(raw.stats);

  return {
    id,
    defId,
    kind: resolveItemKind(category, defId),
    categoryCode: category,
    set: asString(raw.set, definition?.set ?? ''),
    rarityIdx,
    rarityCode: rarityByIdx.get(rarityIdx)?.code ?? null,
    slot: definition?.slot ?? null,
    level,
    upgrade,
    power: asNumber(raw.power, 0),
    sellValueGold: asNumber(raw.sell_value ?? raw.sellValueGold, 0),
    sellable: raw.sellable !== false,
    tradable: raw.tradable === true,
    marketBlocked: raw.marketBlocked === true || Math.round(asNumber(raw.market_state, 0)) !== 0,
    locked: raw.locked === true,
    equipped: equippedBy.length > 0,
    equippedBy: equippedBy.length > 0 ? equippedBy : null,
    inStash: raw.in_stash === true || raw.inStash === true,
    stats: stats.length > 0 ? stats : catalogStats(defId, rarityIdx, level, upgrade),
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

/** Two rows stack when a player could not tell them apart: same definition, same rarity. */
function stackKey(item: InventoryViewItem): string {
  return `${item.defId}|${item.rarityIdx}`;
}

/**
 * Groups by kind, and within every kind but gear collapses identical rows into one counted
 * entry. Group order follows {@link ITEM_KINDS}, not first-seen order, so the page does not
 * reshuffle between two saves that happen to list their rows differently.
 */
export function groupInventoryByKind(items: readonly InventoryViewItem[]): InventoryGroup[] {
  const byKind = new Map<ItemKind, InventoryViewItem[]>();
  for (const item of items) {
    const bucket = byKind.get(item.kind);
    if (bucket) bucket.push(item);
    else byKind.set(item.kind, [item]);
  }

  return ITEM_KINDS.filter((kind) => byKind.has(kind)).map((kind) => {
    const rows = byKind.get(kind) ?? [];
    return { kind, entries: entriesFor(kind, rows), count: rows.length };
  });
}

function entriesFor(kind: ItemKind, rows: readonly InventoryViewItem[]): InventoryEntry[] {
  if (!isStackableKind(kind)) {
    return rows.map((item) => ({ key: item.id, item, count: 1, sellValueGold: item.sellValueGold }));
  }

  const stacks = new Map<string, InventoryEntry>();
  for (const item of rows) {
    const key = stackKey(item);
    const existing = stacks.get(key);
    if (existing) {
      existing.count += 1;
      existing.sellValueGold += item.sellValueGold;
    } else {
      stacks.set(key, { key, item, count: 1, sellValueGold: item.sellValueGold });
    }
  }
  return [...stacks.values()];
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

export type InventoryFilter = {
  /** Free text, matched against whatever the caller says an item reads as. */
  text: string;
  /** Empty means every kind — an explicit "all" beats making the caller list all seven. */
  kinds: readonly ItemKind[];
  rarities: readonly number[];
  equippedOnly: boolean;
};

export const EMPTY_INVENTORY_FILTER: InventoryFilter = {
  text: '',
  kinds: [],
  rarities: [],
  equippedOnly: false,
};

export function isEmptyInventoryFilter(filter: InventoryFilter): boolean {
  return (
    filter.text.trim() === '' &&
    filter.kinds.length === 0 &&
    filter.rarities.length === 0 &&
    !filter.equippedOnly
  );
}

/** Diacritic- and case-insensitive, so "epico" finds "Épico" and "gelo" finds "Geleira". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Narrows a view, then regroups. Regrouping rather than filtering the groups in place is what
 * keeps a stack's count honest: filtering to `equipped` must not leave a key card reading ×11
 * when 11 keys are not what survived.
 *
 * `searchText` is the caller's: item names are localized, and this package holds no i18n.
 */
export function filterInventoryView(
  view: InventoryView,
  filter: InventoryFilter,
  searchText: (item: InventoryViewItem) => string,
): InventoryView {
  if (isEmptyInventoryFilter(filter)) return view;

  const needles = fold(filter.text).split(/\s+/).filter(Boolean);
  const kinds = filter.kinds.length > 0 ? new Set(filter.kinds) : null;
  const rarities = filter.rarities.length > 0 ? new Set(filter.rarities) : null;

  const items = view.items.filter((item) => {
    if (kinds && !kinds.has(item.kind)) return false;
    if (rarities && !rarities.has(item.rarityIdx)) return false;
    if (filter.equippedOnly && !item.equipped) return false;
    if (needles.length === 0) return true;
    const haystack = fold(searchText(item));
    return needles.every((needle) => haystack.includes(needle));
  });

  return { items, groups: groupInventoryByKind(items), skipped: view.skipped };
}

/** Rarity indices present in a view, ascending — the rarity filter's own options, so a chip is
 *  never offered for a tier the account does not hold. */
export function rarityIndicesInView(view: InventoryView): number[] {
  return [...new Set(view.items.map((item) => item.rarityIdx))].sort((a, b) => a - b);
}

/** Kinds present in a view, in {@link ITEM_KINDS} order. */
export function kindsInView(view: InventoryView): ItemKind[] {
  const present = new Set(view.items.map((item) => item.kind));
  return ITEM_KINDS.filter((kind) => present.has(kind));
}
