import { ABILITIES } from '../model';
import type { HeroPlanContext } from './types';

/** Seconds the pulse lasts once it fires — the wiki's `combate.swap_dmg_secs`. */
export const PASSAGEM_BASTAO_WINDOW_SEC = 120;

/**
 * Seconds a carrier must wait between pulses — the wiki's `combate.swap_dmg_cooldown_secs`.
 *
 * **It cannot bind today, and that is a fact about the House, not about this ability.** A hero's
 * re-entry interval is their field seconds plus a full House recovery cycle, and the fastest
 * House in the game recovers in exactly 600 s (`HOUSES`, Casa V at level 20), so every carrier's
 * interval already exceeds this cooldown before their own field time is added. Every entry
 * pulses.
 *
 * The term below is written out anyway rather than dropped, because the thing keeping it inert
 * is a balance table that moves: a faster House — shipped by the game, or reported by a save's
 * own `casa.cycle_secs` — makes it bind immediately, and silently over-crediting the ability is
 * the failure mode worth spending three lines to prevent.
 * `team-plan-ability-extras.test.ts` fails if that floor ever drops.
 */
export const PASSAGEM_BASTAO_COOLDOWN_SEC = 600;

/**
 * Gear-plan-only passagem de bastao model — the shared ABILITIES catalog stays `kind: 'none'`.
 *
 * `1 + 0.04 × rank × (min(W, F) / F) × min(1, T / C)`, where F is the hero's field seconds per
 * deployment, T = F / duty is their full rotation cycle, W is the pulse window and C the pulse
 * cooldown. The first fraction is the share of a deployment the pulse covers; the second is the
 * share of deployments that pulse at all, which is 1 once entries are at least C apart.
 *
 * The second term is 1 for every hero reachable today — see the cooldown constant above for why.
 *
 * `min(1, T / C)` is the smooth reading, not the exact one. A strictly periodic rotation pulses
 * on every `ceil(C / T)`-th entry, so the true share is `1 / ceil(C / T)` — a step function that
 * halves on an arbitrarily small change in energy, and would make this term jump under the
 * optimizer for no physical reason. Real rotations are FIFO-queued and jittered, which smooths
 * those steps out. The smooth form is also the larger of the two, so it errs toward crediting
 * the ability rather than discounting it.
 */
export function passagemBastaoMult(
  rank: number,
  fieldSecondsValue: number,
  dutyValue: number,
): number {
  if (rank <= 0 || !Number.isFinite(fieldSecondsValue) || fieldSecondsValue <= 0) return 1;
  if (!Number.isFinite(dutyValue) || dutyValue <= 0 || dutyValue > 1) {
    throw new RangeError(
      `passagemBastaoMult needs the hero's duty in (0, 1] to derive their rotation cycle; got ${dutyValue}`,
    );
  }
  const window = Math.min(PASSAGEM_BASTAO_WINDOW_SEC, fieldSecondsValue);
  const cycleSeconds = fieldSecondsValue / dutyValue;
  const pulsingEntries = Math.min(1, cycleSeconds / PASSAGEM_BASTAO_COOLDOWN_SEC);
  return 1 + 0.04 * rank * (window / fieldSecondsValue) * pulsingEntries;
}

const UNMODELLED_IDS = ['matilha', 'brecha', 'caca_hero', 'fantasma'] as const;

export type UnmodelledAbilityEntry = {
  abilityId: string;
  heroNames: string[];
  assumptionBased?: boolean;
};

/** Heroes carrying unmodelled / assumption-based abilities for unmodelled-ability disclosures. */
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

  const bastaoNames = contexts
    .filter((ctx) => ctx.scope === 'optimize' && (ctx.abilities.passagem_bastao ?? 0) >= 1)
    .map((ctx) => ctx.name);
  if (bastaoNames.length > 0) {
    out.push({
      abilityId: 'passagem_bastao',
      heroNames: bastaoNames,
      assumptionBased: true,
    });
  }

  return out;
}

/** The boundary this helper respects: the shared catalog stays `kind: 'none'`. */
export function passagemBastaoCatalogUnmodelled(): boolean {
  const def = ABILITIES.find((a) => a.id === 'passagem_bastao');
  return def?.effect.kind === 'none';
}
