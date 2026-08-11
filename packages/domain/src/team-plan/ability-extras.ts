import { ABILITIES } from '../model';
import type { HeroPlanContext } from './types';

/** ASM-S04 — 120 s window for passagem de bastao average multiplier. */
export const PASSAGEM_BASTAO_WINDOW_SEC = 120;

/**
 * Gear-plan-only passagem de bastao model (ASM-S03 — shared ABILITIES catalog untouched).
 * `1 + 0.04 × rank × min(120, F) / F`
 */
export function passagemBastaoMult(rank: number, fieldSecondsValue: number): number {
  if (rank <= 0 || !Number.isFinite(fieldSecondsValue) || fieldSecondsValue <= 0) return 1;
  const window = Math.min(PASSAGEM_BASTAO_WINDOW_SEC, fieldSecondsValue);
  return 1 + 0.04 * rank * (window / fieldSecondsValue);
}

const UNMODELLED_IDS = ['matilha', 'brecha', 'caca_hero', 'fantasma'] as const;

export type UnmodelledAbilityEntry = {
  abilityId: string;
  heroNames: string[];
  assumptionBased?: boolean;
};

/** Heroes carrying unmodelled / assumption-based abilities for RGO-17 disclosures. */
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

/** ASM-S03 boundary — catalog stays `kind: 'none'`. */
export function passagemBastaoCatalogUnmodelled(): boolean {
  const def = ABILITIES.find((a) => a.id === 'passagem_bastao');
  return def?.effect.kind === 'none';
}
