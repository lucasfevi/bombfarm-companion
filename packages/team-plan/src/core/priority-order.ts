import { resolveHeroScope, type ScopeState } from './hero-scope';

type ScopedHero = { id: string; battleAllowed?: boolean };

/** The Optimize heroes in gearing order: the stored order first, then the rest in roster order. */
export function resolvePriorityOrder(
  heroes: readonly ScopedHero[],
  scopeByHeroId: Record<string, ScopeState>,
  stored: readonly string[],
): string[] {
  const optimizeIds = heroes
    .filter((hero) => resolveHeroScope(hero, scopeByHeroId) === 'optimize')
    .map((hero) => hero.id);
  const optimize = new Set(optimizeIds);
  const listed = stored.filter((heroId) => optimize.has(heroId));
  const listedIds = new Set(listed);
  return [...listed, ...optimizeIds.filter((heroId) => !listedIds.has(heroId))];
}

/** `heroId` placed directly before `beforeHeroId`, or last when that is `null` or absent. */
export function movePriorityBefore(
  order: readonly string[],
  heroId: string,
  beforeHeroId: string | null,
): string[] {
  const rest = order.filter((id) => id !== heroId);
  const index = beforeHeroId === null ? -1 : rest.indexOf(beforeHeroId);
  if (index < 0) return [...rest, heroId];
  return [...rest.slice(0, index), heroId, ...rest.slice(index)];
}

/** `heroId` moved `delta` places, clamped to the ends. */
export function shiftPriority(order: readonly string[], heroId: string, delta: number): string[] {
  const from = order.indexOf(heroId);
  if (from < 0) return [...order];
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  const next = order.filter((id) => id !== heroId);
  next.splice(to, 0, heroId);
  return next;
}
