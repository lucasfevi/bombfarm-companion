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
 * The account block is the invalidation key. It is rebuilt from the payload on every account read
 * that actually changed something, so a cache entry can never outlive the numbers it was computed
 * from — which is the failure a per-hero-id cache alone would have.
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
  account: AccountShared | null;
  entries: Map<string, readonly AbilityGain[]>;
};

export function createAbilityGainCache(): AbilityGainCache {
  return { account: null, entries: new Map() };
}

export function cachedAbilityGains(
  cache: AbilityGainCache,
  compute: AbilityGainCompute,
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
): readonly AbilityGain[] {
  if (cache.account !== account) {
    cache.account = account;
    cache.entries.clear();
  }

  const key = `${hero.id} ${String(phase)}`;
  const cached = cache.entries.get(key);
  if (cached !== undefined) return cached;

  const gains = compute(hero, account, phase, mitigationPct);
  cache.entries.set(key, gains);
  return gains;
}
