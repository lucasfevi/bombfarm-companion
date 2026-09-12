/**
 * One combat-model pass per ability is what an ability panel costs, and this screen re-renders on
 * every account push — several a minute while the game is open, most of them changing nothing the
 * panel reads. `abilityGainFor` is deliberately pure and uncached, so memoising it is the caller's
 * job, and this is that memo.
 *
 * Keyed by hero AND phase: switching hero and switching phase are both one keystroke on this
 * screen, and a cache holding only the current pair would recompute the whole panel every time the
 * player looked back at a hero they had already opened.
 *
 * `computedFrom` is the invalidation key — the references every cached reading was computed from,
 * compared one by one. The screen hands it the account block, rebuilt from the payload on every
 * account read that actually changed something, and the aura switches, so a cache entry can never
 * outlive the numbers it was computed from — which is the failure a per-hero-id cache alone would
 * have. It is NOT the per-hero `account` itself: that one is derived per hero (its own auras are
 * overlaid on the block), so keying on it would empty the cache on every hero switch.
 */
import type { AbilityGain } from '@bombfarm/domain/ability-gain';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';

export type AbilityGainCompute = (
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
) => readonly AbilityGain[];

export type AbilityGainCache = {
  computedFrom: readonly unknown[] | null;
  entries: Map<string, readonly AbilityGain[]>;
};

export function createAbilityGainCache(): AbilityGainCache {
  return { computedFrom: null, entries: new Map() };
}

function sameReferences(left: readonly unknown[] | null, right: readonly unknown[]): boolean {
  return (
    left !== null &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}

export function cachedAbilityGains(
  cache: AbilityGainCache,
  compute: AbilityGainCompute,
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
  computedFrom: readonly unknown[],
): readonly AbilityGain[] {
  if (!sameReferences(cache.computedFrom, computedFrom)) {
    cache.computedFrom = computedFrom;
    cache.entries.clear();
  }

  const key = `${hero.id} ${String(phase)}`;
  const cached = cache.entries.get(key);
  if (cached !== undefined) return cached;

  const gains = compute(hero, account, phase, mitigationPct);
  cache.entries.set(key, gains);
  return gains;
}
