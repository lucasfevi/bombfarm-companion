import catalog from './data/catalog.json' with { type: 'json' };

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

/**
 * A chest's `rarity` is 0 on the wire whatever tier it is; the tier lives in the id's tail
 * instead, so `chest_time_2` is the Raro time chest. Deriving it here rather than in a card means
 * the border, the plate, the tier word and any future sort all agree without each one knowing the
 * convention.
 *
 * Item chests are deliberately NOT in this list: their tail is a LEVEL (`chest_item_90`), not a
 * rarity, and reading it as one would ask for rarity 90. Key chests ARE, on the same evidence as
 * the other three — same id shape, and the only values the corpus holds (`_3`, `_5`) are valid
 * rarity indices.
 */
const TIERED_CHEST = /^chest_(?:time|gem|skill|key)_(\d)$/;

export function chestRarityIdx(defId: string, wireRarity: number): number {
  const tail = TIERED_CHEST.exec(defId);
  if (!tail) return wireRarity;
  const tier = Number(tail[1]);
  return tier >= 0 && tier <= 5 ? tier : wireRarity;
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
  const rarityIdx = chestRarityIdx(defId, Math.round(asNumber(raw.rarity ?? raw.rarityIdx, 0)));
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
  /** Rank letter (`A`, `S`, …); empty when the hero has not been ranked. */
  rank: string;
  /** Gems-to-stars ritual count. */
  stars: number;
  /** Cosmetic skin index, for the avatar. */
  skin: number;
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
      rank: asString(raw.rank),
      stars: Math.round(asNumber(raw.stars, 0)),
      skin: Math.round(asNumber(raw.skin, 0)),
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
  /** Save hero ids, matched against `equippedBy`. Empty means every hero. */
  heroIds: readonly string[];
  /**
   * Catalog set slugs. `null` means every set — including, importantly, the kinds that have no set
   * at all. Naming a set is naming a gear level, since the two are the same axis, so a list also
   * means "gear only".
   *
   * The empty list is a real state and not a synonym for `null`: it is what the set picker holds
   * when every box is unticked, and it matches nothing. Collapsing the two is what made the
   * picker's `Clear` a no-op — unticking the last box read as "no filter" and re-ticked all of them.
   */
  sets: readonly string[] | null;
  equippedOnly: boolean;
};

export const EMPTY_INVENTORY_FILTER: InventoryFilter = {
  text: '',
  kinds: [],
  rarities: [],
  heroIds: [],
  sets: null,
  equippedOnly: false,
};

export function isEmptyInventoryFilter(filter: InventoryFilter): boolean {
  return (
    filter.text.trim() === '' &&
    filter.kinds.length === 0 &&
    filter.rarities.length === 0 &&
    filter.heroIds.length === 0 &&
    filter.sets === null &&
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
  const heroIds = filter.heroIds.length > 0 ? new Set(filter.heroIds) : null;
  const sets = filter.sets ? new Set(filter.sets) : null;

  const items = view.items.filter((item) => {
    if (kinds && !kinds.has(item.kind)) return false;
    if (rarities && !rarities.has(item.rarityIdx)) return false;
    if (heroIds && (item.equippedBy === null || !heroIds.has(item.equippedBy))) return false;
    if (sets && !sets.has(item.set)) return false;
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

export type InventorySetGroup = {
  /** Catalog slug (`coal`), which is the filter's value. */
  set: string;
  /** The set's own item level. Every set sits at exactly one — there are 30 of each and the
   *  catalog pairs them 1:1, which is why a set filter IS a level filter. */
  level: number;
  /** Gear pieces of this set the account holds. */
  count: number;
};

/**
 * The sets present in a view, in level order — the set filter's own options, so a set the account
 * does not own is never offered. Level-ordered rather than alphabetical because the level is what
 * the list actually ranks by; the names are just how a player says it.
 */
export function setsInView(view: InventoryView): InventorySetGroup[] {
  const bySet = new Map<string, InventorySetGroup>();
  for (const item of view.items) {
    if (item.kind !== 'equipment' || !item.set) continue;
    const existing = bySet.get(item.set);
    if (existing) existing.count += 1;
    else bySet.set(item.set, { set: item.set, level: item.level, count: 1 });
  }
  return [...bySet.values()].sort((a, b) => a.level - b.level || a.set.localeCompare(b.set));
}

/** Hero ids that wear at least one item in a view — the hero filter's own options, so a hero
 *  carrying nothing is never offered. First-seen order; the caller sorts by whatever it can name. */
export function heroIdsInView(view: InventoryView): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of view.items) {
    if (item.equippedBy === null || seen.has(item.equippedBy)) continue;
    seen.add(item.equippedBy);
    ids.push(item.equippedBy);
  }
  return ids;
}

export type InventorySortKey = 'rarity' | 'level' | 'value' | 'name' | 'count';
export type InventorySortDirection = 'asc' | 'desc';
export type InventorySortTerm = { key: InventorySortKey; direction: InventorySortDirection };

/** Most significant term first. */
export type InventorySort = readonly InventorySortTerm[];

export const INVENTORY_SORT_KEYS: readonly InventorySortKey[] = ['rarity', 'level', 'value', 'name', 'count'];

/**
 * Best-first, then newest-first within a tier — what a player scanning for an upgrade wants
 * before anything else, and the reason the default is two terms rather than one: rarity alone
 * leaves a Lendária nv10 sitting above a Lendária nv100.
 */
export const DEFAULT_INVENTORY_SORT: InventorySort = [
  { key: 'rarity', direction: 'desc' },
  { key: 'level', direction: 'desc' },
];

/** Beyond three, the tail terms stop being something a reader can hold in their head. */
const MAX_SORT_TERMS = 3;

/**
 * Folds a newly chosen term into the existing order. The new key becomes the MOST significant
 * one and every previously chosen key slides down a rank, which is what makes picking "level
 * ascending" and then "rarity descending" mean *rarity descending, ties broken by level
 * ascending* rather than throwing the first choice away.
 *
 * Re-choosing the key that is already primary just sets its direction — flipping asc/desc must
 * not reshuffle the terms under it.
 */
export function withSortTerm(sort: InventorySort, term: InventorySortTerm): InventorySort {
  const rest = sort.filter((existing) => existing.key !== term.key);
  return [term, ...rest].slice(0, MAX_SORT_TERMS);
}

/** The direction currently applied to `key`, or `null` when it is not part of the order. */
export function sortDirectionFor(sort: InventorySort, key: InventorySortKey): InventorySortDirection | null {
  return sort.find((term) => term.key === key)?.direction ?? null;
}

function sortValue(entry: InventoryEntry, key: InventorySortKey): number {
  switch (key) {
    case 'rarity':
      return entry.item.rarityIdx;
    case 'level':
      return entry.item.level;
    case 'value':
      return entry.sellValueGold;
    case 'count':
      return entry.count;
    case 'name':
      return 0;
  }
}

/**
 * Sorts within each group rather than across the whole view: the groups are the page's structure,
 * and a sort that reordered them would put a key between two swords.
 *
 * `nameOf` is the caller's, since item names are localized and this package holds no i18n. It is
 * also the final tie-break for every other key, so a rarity sort still lists a set together
 * rather than in whatever order the save happened to send.
 */
export function sortInventoryView(
  view: InventoryView,
  sort: InventorySort,
  nameOf: (item: InventoryViewItem) => string,
): InventoryView {
  const compare = (a: InventoryEntry, b: InventoryEntry): number => {
    for (const term of sort) {
      const sign = term.direction === 'asc' ? 1 : -1;
      const delta =
        term.key === 'name'
          ? nameOf(a.item).localeCompare(nameOf(b.item))
          : sortValue(a, term.key) - sortValue(b, term.key);
      if (delta !== 0) return sign * delta;
    }

    const byName = nameOf(a.item).localeCompare(nameOf(b.item));
    if (byName !== 0) return byName;
    // Last resort: the stack key. Without it two identically-named entries can swap places
    // between renders, and a grid that reshuffles under a hover reads as a bug.
    return a.key.localeCompare(b.key);
  };

  return { ...view, groups: view.groups.map((group) => ({ ...group, entries: [...group.entries].sort(compare) })) };
}
