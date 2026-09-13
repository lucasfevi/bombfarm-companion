export type ScopeState = 'optimize' | 'donate' | 'leaveAlone';

export function defaultScopeForHero(battleAllowed: boolean | undefined): ScopeState {
  return battleAllowed === false ? 'donate' : 'optimize';
}

export function resolveHeroScope(
  hero: { id: string; battleAllowed?: boolean },
  scopeByHeroId: Record<string, ScopeState>,
): ScopeState {
  return scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed);
}

export function buildDefaultScopeMap(
  heroes: { id: string; battleAllowed?: boolean }[],
): Record<string, ScopeState> {
  const scopeByHeroId: Record<string, ScopeState> = {};
  for (const hero of heroes) {
    scopeByHeroId[hero.id] = defaultScopeForHero(hero.battleAllowed);
  }
  return scopeByHeroId;
}

/** Full roster map: battleAllowed defaults, then keep any existing per-hero choices. */
export function mergeScopeForRoster(
  heroes: { id: string; battleAllowed?: boolean }[],
  existing: Record<string, ScopeState>,
): Record<string, ScopeState> {
  const next = buildDefaultScopeMap(heroes);
  for (const hero of heroes) {
    const stored = existing[hero.id];
    if (stored) next[hero.id] = stored;
  }
  return next;
}

export function countOptimizeScopeHeroes(
  heroes: readonly { id: string; battleAllowed?: boolean }[],
  scopeByHeroId: Record<string, ScopeState>,
): number {
  return heroes.filter((hero) => resolveHeroScope(hero, scopeByHeroId) === 'optimize').length;
}

export function heroScopeKey(hero: { id: string; sourceId?: string }): string {
  return hero.sourceId ?? hero.id;
}
