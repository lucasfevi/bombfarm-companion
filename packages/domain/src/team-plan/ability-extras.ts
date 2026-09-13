import { ABILITIES } from '../model';
import type { HeroPlanContext } from './types';

/**
 * Abilities no objective prices at all. Passagem de Bastão is not one: it is priced over the
 * rotation like the team auras (`evaluate.ts`, `farm-rate.ts`), and listing a carrier here would
 * contradict the disclosure sentence above the list that says so.
 */
const UNMODELLED_IDS = ['matilha', 'brecha', 'caca_hero', 'fantasma'] as const;

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

/** The boundary the pulse respects: it is priced on rates, never on the sheet, so the shared
 *  catalog stays `kind: 'none'`. */
export function passagemBastaoCatalogUnmodelled(): boolean {
  const def = ABILITIES.find((a) => a.id === 'passagem_bastao');
  return def?.effect.kind === 'none';
}
