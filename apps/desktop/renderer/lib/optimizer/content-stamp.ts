/**
 * The two stamps the package's input signature reads, derived from content rather than from a
 * clock.
 *
 * The signature the plan is keyed to reads a hero's `updatedAt` and the inventory's `importedAt`
 * as its only view of their content. On the web those move when the player edits; here the
 * account is re-read every few seconds, and the section capture time moves with every read
 * whether or not a hero changed — so stamping by capture time would call every plan stale after
 * the first gold tick, and stamping a constant would never call a re-geared hero stale. A hash of
 * the content moves exactly when the content does.
 */
import { canonicalStringify } from '@bombfarm/contracts';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

/** 32-bit FNV1a (the Fowler–Noll–Vo hash, "a" variant), unsigned. */
function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function heroContentStamp(hero: HeroRecord): number {
  const { updatedAt: _updatedAt, ...rest } = hero;
  return fnv1a32(canonicalStringify(rest));
}

export function inventoryContentStamp(items: readonly InventoryItem[]): number {
  return fnv1a32(canonicalStringify(items));
}
