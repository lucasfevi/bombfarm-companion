import type { HeroPlanContext } from './types';

/**
 * Abilities no objective prices at all. A team aura is not one — Brecha and Passagem de Bastão
 * are priced over the rotation like the others (`evaluate.ts`, `farm-rate.ts`) — and nor is
 * Matilha, whose pack bonus is priced at the field size the rotation sustains.
 */
const UNMODELLED_IDS = ['caca_hero', 'fantasma'] as const;

export type UnmodelledAbilityEntry = {
  abilityId: string;
  heroNames: string[];
};

/** Heroes carrying unmodelled abilities, for the plan's unmodelled-ability disclosure. */
export function unmodelledAbilitiesInScope(contexts: HeroPlanContext[]): UnmodelledAbilityEntry[] {
  const out: UnmodelledAbilityEntry[] = [];

  for (const abilityId of UNMODELLED_IDS) {
    const heroNames = contexts
      .filter((ctx) => ctx.scope === 'optimize' && (ctx.abilities[abilityId] ?? 0) >= 1)
      .map((ctx) => ctx.name);
    if (heroNames.length > 0) {
      out.push({ abilityId, heroNames });
    }
  }

  return out;
}
