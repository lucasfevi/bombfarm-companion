/**
 * What every piece in the forge queue is forged with: the Chance Stone per target level, whether
 * to stop when a chosen stone runs out, and the Protection Scroll. One setting for the whole
 * queue, remembered across a reload, kept in absolute target levels — a piece already part-way
 * up simply starts inside the ranges.
 */
import { FORGE_GUARANTEED, FORGE_MAX, FORGE_STONE_RARITIES, type ForgeStones } from '@bombfarm/domain/forge';
import {
  MAX_STONE_RANGES,
  addStoneRange,
  joinStoneRanges,
  removeStoneRange,
  resolveStoneRanges,
  setStoneRangeEnd,
  setStoneRarity,
  stonesByTarget,
  type ForgeStoneRange,
  type ResolvedStoneRange,
} from './forge-stones';
import type { ForgeStoneEdit } from './use-forge-plan';

const FORGE_QUEUE_SETTINGS_KEY = 'bfc-forge-queue-settings';

export type ForgeQueueSettings = {
  readonly ranges: readonly ForgeStoneRange[];
  readonly stopWhenOutOfStones: boolean;
  readonly scroll: boolean;
};

export const DEFAULT_FORGE_QUEUE_SETTINGS: ForgeQueueSettings = { ranges: [], stopWhenOutOfStones: true, scroll: false };

export function queueStoneRanges(settings: ForgeQueueSettings): ResolvedStoneRange[] {
  return resolveStoneRanges(settings.ranges, FORGE_GUARANTEED, FORGE_MAX);
}

export function queueStones(settings: ForgeQueueSettings): ForgeStones | undefined {
  return stonesByTarget(queueStoneRanges(settings));
}

export function editQueueStoneRanges(settings: ForgeQueueSettings, edit: ForgeStoneEdit): ForgeQueueSettings {
  const { ranges } = settings;
  const [from, to] = [FORGE_GUARANTEED, FORGE_MAX];
  switch (edit.kind) {
    case 'stoneRarity':
      return { ...settings, ranges: setStoneRarity(ranges, from, to, edit.index, edit.rarity) };
    case 'stoneEnd':
      return { ...settings, ranges: setStoneRangeEnd(ranges, from, to, edit.index, edit.upTo) };
    case 'stoneAdd':
      return { ...settings, ranges: addStoneRange(ranges, from, to) };
    case 'stoneJoin':
      return { ...settings, ranges: joinStoneRanges(ranges, from, to) };
    case 'stoneRemove':
      return { ...settings, ranges: removeStoneRange(ranges, from, to, edit.index) };
  }
}

function isRange(value: unknown): value is ForgeStoneRange {
  if (typeof value !== 'object' || value === null) return false;
  const raw = value as Record<string, unknown>;
  const rarityOk =
    raw.rarity === null ||
    (typeof raw.rarity === 'number' && Number.isInteger(raw.rarity) && raw.rarity >= 0 && raw.rarity < FORGE_STONE_RARITIES);
  return typeof raw.upTo === 'number' && Number.isInteger(raw.upTo) && rarityOk;
}

/** Never throws: anything that does not read as settings falls back, field by field, to the
 *  default, and a stored range list is re-settled against +5…+15 so it is always contiguous. */
export function normalizeForgeQueueSettings(value: unknown): ForgeQueueSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_FORGE_QUEUE_SETTINGS;
  const raw = value as Record<string, unknown>;
  const stored = Array.isArray(raw.ranges) ? raw.ranges.filter(isRange).slice(0, MAX_STONE_RANGES) : [];
  const settled = resolveStoneRanges(stored, FORGE_GUARANTEED, FORGE_MAX).map((range) => ({ upTo: range.to, rarity: range.rarity }));
  const ranges = settled.every((range) => range.rarity === null) ? [] : settled;
  return {
    ranges,
    stopWhenOutOfStones: typeof raw.stopWhenOutOfStones === 'boolean' ? raw.stopWhenOutOfStones : DEFAULT_FORGE_QUEUE_SETTINGS.stopWhenOutOfStones,
    scroll: typeof raw.scroll === 'boolean' ? raw.scroll : DEFAULT_FORGE_QUEUE_SETTINGS.scroll,
  };
}

export function loadForgeQueueSettings(): ForgeQueueSettings {
  try {
    const stored = window.localStorage.getItem(FORGE_QUEUE_SETTINGS_KEY);
    if (stored === null) return DEFAULT_FORGE_QUEUE_SETTINGS;
    return normalizeForgeQueueSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_FORGE_QUEUE_SETTINGS;
  }
}

export function saveForgeQueueSettings(settings: ForgeQueueSettings): void {
  try {
    window.localStorage.setItem(FORGE_QUEUE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings that are not remembered are chosen again; not worth failing over.
  }
}
