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

/** The resolved view of a sparse stored map: every roster hero, its own choice or its default. */
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

export function pruneScopeToRoster(
  heroes: readonly { id: string }[],
  stored: Record<string, ScopeState>,
): Record<string, ScopeState> {
  const out: Record<string, ScopeState> = {};
  for (const hero of heroes) {
    const scope = stored[hero.id];
    if (scope) out[hero.id] = scope;
  }
  return out;
}

/** One-off cleanup of maps written before the stored map went sparse, when every hero's default
 *  was saved as if chosen. Keeps only entries that differ from the hero's current default and are
 *  not Donate on a hero whose battle is on. Entries for heroes outside the given roster are kept. */
export function dropMaterialisedScopeDefaults(
  heroes: readonly { id: string; battleAllowed?: boolean }[],
  stored: Record<string, ScopeState>,
): Record<string, ScopeState> {
  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const out: Record<string, ScopeState> = {};
  for (const [heroId, scope] of Object.entries(stored)) {
    const hero = heroById.get(heroId);
    if (hero) {
      if (scope === defaultScopeForHero(hero.battleAllowed)) continue;
      if (scope === 'donate' && hero.battleAllowed === true) continue;
    }
    out[heroId] = scope;
  }
  return out;
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
