import type { InventoryItem, ItemKind, Rarity, RawInventoryBag, RawInventoryItem, Slot } from '@bombfarm/contracts';
import { isPlausibleDefId, isPlausibleId, isRecord, parseNumericField } from '../validation.js';

const SLOT_EN: Record<Slot, string> = {
  0: 'weapon',
  1: 'helmet',
  2: 'armor',
  3: 'legs',
  4: 'boots',
  5: 'gloves',
  6: 'ring',
  7: 'amulet',
};

export interface InventoryParseResult {
  ok: true;
  bag: RawInventoryBag;
  items: InventoryItem[];
  bagTabs: number;
  bagCapacity: number;
}

export interface InventoryParseFailure {
  ok: false;
  reason: string;
}

export type InventoryParseOutput = InventoryParseResult | InventoryParseFailure;

function inferKind(defId: string): ItemKind {
  if (defId.startsWith('gem_')) return 'gem';
  if (defId.startsWith('map_key_')) return 'key';
  if (defId.startsWith('time_part_')) return 'material';
  return 'equipment';
}

function parseSlot(value: unknown): Slot | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 7) return null;
  return n as Slot;
}

function computeIconUrl(set: string, level: number, slot: Slot | null): string {
  if (!set || slot == null) return '';
  const slotName = SLOT_EN[slot];
  return `https://wiki.bombfarm.net/wiki/static/assets/items/lvl${String(level)}_${slotName}_${set}.png`;
}

function isGarbageItem(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  if (!isPlausibleId(raw.id)) return true;
  if (!isPlausibleDefId(raw.def_id)) return true;
  return false;
}

function mapItem(raw: RawInventoryItem): InventoryItem | null {
  if (isGarbageItem(raw)) return null;

  const defId = raw.def_id;
  const slot = parseSlot(raw.slot);
  const rarityRaw = raw.rarity ?? 0;
  if (!Number.isInteger(rarityRaw) || rarityRaw < 0 || rarityRaw > 5) return null;
  const rarity = rarityRaw as Rarity;

  const level = raw.level ?? 0;
  const upgrade = raw.upgrade ?? 0;
  const power = raw.power ?? 0;
  const sellValueGold = parseNumericField(raw.sell_value) ?? 0;
  const marketState = raw.market_state ?? (raw.market === false ? 0 : 0);
  const tradable = raw.tradable === true;
  const locked = raw.locked === true;
  const equippedOn = raw.equipped_on != null && isPlausibleId(raw.equipped_on) ? raw.equipped_on : null;
  const equipSlot = parseSlot(raw.equip_slot);
  const set = typeof raw.set === 'string' ? raw.set : '';

  return {
    id: raw.id,
    defId,
    kind: inferKind(defId),
    set,
    rarity,
    slot,
    level,
    upgrade,
    power,
    stats: Array.isArray(raw.stats)
      ? raw.stats
          .filter((s): s is { stat: number; value: number; effective: number } =>
            isRecord(s) && typeof s.stat === 'number' && typeof s.value === 'number' && typeof s.effective === 'number',
          )
      : [],
    sellValueGold,
    tradable,
    marketState,
    locked,
    equippedOn,
    equipSlot,
    iconUrl: computeIconUrl(set, level, slot),
  };
}

export function classifyInventoryBag(value: unknown): value is RawInventoryBag {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.items)) return false;
  if (value.items.some((item) => isGarbageItem(item))) return false;
  if (value.items.length > 0 && !value.items.every((item) => isRecord(item) && isPlausibleId(item.id) && isPlausibleDefId(item.def_id))) {
    return false;
  }
  return typeof value.bag_tabs === 'number' || typeof value.bag_capacity === 'number' || value.items.length > 0;
}

export function parseInventoryBag(value: unknown): InventoryParseOutput {
  if (!classifyInventoryBag(value)) {
    return { ok: false, reason: 'not_an_inventory_bag' };
  }

  const bag = value;
  const items: InventoryItem[] = [];
  for (const raw of bag.items) {
    const mapped = mapItem(raw);
    if (mapped) items.push(mapped);
  }

  return {
    ok: true,
    bag,
    items,
    bagTabs: bag.bag_tabs ?? 1,
    bagCapacity: bag.bag_capacity ?? items.length,
  };
}
