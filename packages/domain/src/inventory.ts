import catalog from './data/catalog.json' with { type: 'json' };

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export type InventoryItem = {
  id: string;
  defId: string;
  rarityIdx: number;
  level: number;
  upgrade: number;
  /** Catalog-resolved slot; `null` when `defId` does not resolve. */
  slot: string | null;
  equipped: boolean;
  equippedBy: string | null;
  defResolved: boolean;
  marketBlocked: boolean;
};

export type InventorySnapshot = {
  version: 1;
  importedAt: number;
  items: InventoryItem[];
};

const EMPTY_SNAPSHOT: InventorySnapshot = { version: 1, importedAt: 0, items: [] };

/**
 * Maps one raw save `items[]` entry to {@link InventoryItem}, or `null` when the row is
 * not gear (`category !== 0`). Slot comes from the catalog definition — the save's numeric
 * `equip_slot` uses a different ordering (see `import-save.ts` hero loop).
 */
export function mapInventoryItem(raw: Record<string, unknown>): InventoryItem | null {
  if (Math.round(asNumber(raw.category, -1)) !== 0) return null;

  const defId = asString(raw.def_id);
  const definition = defById.get(defId);
  const equippedOn = asString(raw.equipped_on);
  const equipped = equippedOn.length > 0;

  return {
    id: asString(raw.id),
    defId,
    rarityIdx: Math.round(asNumber(raw.rarity, 0)),
    level: asNumber(raw.level, 10),
    upgrade: Math.round(asNumber(raw.upgrade, 0)),
    slot: definition?.slot ?? null,
    equipped,
    equippedBy: equipped ? equippedOn : null,
    defResolved: Boolean(definition),
    marketBlocked: Math.round(asNumber(raw.market_state, 0)) !== 0,
  };
}

/** Coerce persisted / partial inventory JSON into a safe snapshot (RGO-29). */
export function normalizeInventorySnapshot(raw: unknown): InventorySnapshot {
  if (raw == null || typeof raw === 'string' || typeof raw === 'number') {
    return { ...EMPTY_SNAPSHOT, items: [] };
  }
  if (!isObject(raw)) return { ...EMPTY_SNAPSHOT, items: [] };

  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) return { ...EMPTY_SNAPSHOT, items: [] };

  const items: InventoryItem[] = [];
  for (const entry of itemsRaw) {
    if (!isObject(entry)) continue;
    const id = asString(entry.id);
    const defId = asString(entry.defId ?? entry.def_id);
    if (!id || !defId) continue;
    const definition = defById.get(defId);
    items.push({
      id,
      defId,
      rarityIdx: Math.round(asNumber(entry.rarityIdx ?? entry.rarity, 0)),
      level: asNumber(entry.level, 10),
      upgrade: Math.round(asNumber(entry.upgrade, 0)),
      slot: definition?.slot ?? (typeof entry.slot === 'string' ? entry.slot : null),
      equipped: Boolean(entry.equipped),
      equippedBy:
        typeof entry.equippedBy === 'string'
          ? entry.equippedBy
          : typeof entry.equipped_by === 'string'
            ? entry.equipped_by
            : null,
      defResolved: Boolean(definition),
      marketBlocked: Boolean(entry.marketBlocked ?? entry.market_blocked),
    });
  }

  const importedAt = asNumber(raw.importedAt, 0);
  return {
    version: 1,
    importedAt: importedAt > 0 ? importedAt : 0,
    items,
  };
}
