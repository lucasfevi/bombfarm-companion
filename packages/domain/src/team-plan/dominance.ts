import { scaledValores } from '../gear/catalog';
import type { PoolEntry } from './types';

/**
 * When one piece of gear beats another outright, read off the catalog rather than assumed.
 *
 * COMPARISONS CROSS SETS. An earlier rule scoped this to a single `defId`, on the premise that
 * sets differ in which stats they roll and so two sets are incomparable. That was true in beta and
 * is not true now: every slot's thirty sets roll the same stats in the same order, and a roll is
 * `statBase × nivelMult[level] × forja` (weapons carry a further flat ×5 that every weapon set
 * shares). Within a slot an item is therefore fully described by (level, rarity, forge) and the
 * set name is cosmetic — a clay amulet beats a coal one of equal rarity and forge outright.
 *
 * Comparing the scaled rolls themselves, rather than those three fields, keeps the conclusion tied
 * to the catalog: if a future set ever does roll differently, this degrades to "incomparable" on
 * its own instead of silently asserting a rule that has stopped holding.
 */

/** What one pool entry rolls, at the forge level scoring will use. */
export function statsForEntry(entry: PoolEntry): Map<string, number> {
  const stats = new Map<string, number>();
  for (const roll of scaledValores(entry.defId, entry.rarityIdx, entry.level, entry.effectiveUpgrade)) {
    stats.set(roll.stat, roll.valor);
  }
  return stats;
}

/** Stable identity for a stat vector, so two entries that roll the same numbers collapse to one. */
export function statSignature(stats: ReadonlyMap<string, number>): string {
  return [...stats]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([stat, valor]) => `${stat}=${valor}`)
    .join(',');
}

/**
 * `a` rolls every stat `b` does at no lower a value, and beats it somewhere.
 *
 * A stat `b` lacks counts as zero, which is what makes a higher rarity dominate a lower one at
 * equal level and forge. Says nothing about whether a hero can EQUIP either — `eligibleForHero`'s
 * level gate is a separate test, and every caller must apply it before acting on this.
 */
export function dominates(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
): boolean {
  let strict = false;
  for (const [stat, valor] of b) {
    const mine = a.get(stat) ?? 0;
    if (mine < valor) return false;
    if (mine > valor) strict = true;
  }
  if (strict) return true;
  for (const [stat, valor] of a) {
    if (valor > (b.get(stat) ?? 0)) return true;
  }
  return false;
}
