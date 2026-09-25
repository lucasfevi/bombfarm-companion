/**
 * What a hero is built for, read off the abilities it has invested in.
 *
 * A label for a card, not a model input: nothing prices a hero by its type. Matilha votes for the
 * heavy hitter because it scales the carrier's own damage by the allies beside it — it is not a
 * team aura. Fortuna is one, so it votes as loot and also shows among the squad's auras.
 */
import type { ShowcaseCopy } from '../copy';

export const HERO_TYPE_IDS = [
  'crit',
  'heavy',
  'pierce',
  'finish',
  'gate',
  'loot',
  'buff',
  'endure',
] as const;

export type HeroTypeId = (typeof HERO_TYPE_IDS)[number];

export const HERO_TYPE_VOTERS: Readonly<Record<HeroTypeId, readonly string[]>> = {
  crit: ['olho_clinico', 'golpe_brutal'],
  heavy: ['detonacao_dupla', 'matilha'],
  pierce: ['ponta_diamante'],
  finish: ['misericordia'],
  gate: ['contra_relogio', 'caca_hero'],
  loot: ['veia_ouro', 'olho_lapidador', 'fortuna'],
  buff: [
    'grito_guerra',
    'marcha_acelerada',
    'passagem_bastao',
    'folego_mineiro',
    'pressagio_mortal',
    'brecha',
  ],
  endure: ['bateria_extra', 'fantasma'],
};

/** Nearly every hero carries it, so a vote from it would call the whole roster the same thing. */
export const WIDE_BLAST_ABILITY_ID = 'explosao_ampla';

/** A few levels bought on the way to something else say nothing about what a hero is for. */
export const HERO_TYPE_MIN_VOTING_LEVEL = 10;

/** How close a runner-up has to come to the leading type to be named beside it. */
export const SECOND_HERO_TYPE_SHARE = 0.6;

const TYPE_BY_ABILITY = new Map<string, HeroTypeId>(
  HERO_TYPE_IDS.flatMap((type) => HERO_TYPE_VOTERS[type].map((abilityId) => [abilityId, type] as const)),
);

export function heroTypeOfAbility(abilityId: string): HeroTypeId | undefined {
  return TYPE_BY_ABILITY.get(abilityId);
}

/** Up to two types, the leading one first; empty for a hero with no ability at voting level. */
export function heroTypesFor(abilities: Readonly<Record<string, number>>): readonly HeroTypeId[] {
  const scores = new Map<HeroTypeId, number>();
  for (const [abilityId, level] of Object.entries(abilities)) {
    const type = TYPE_BY_ABILITY.get(abilityId);
    if (type === undefined || level < HERO_TYPE_MIN_VOTING_LEVEL) continue;
    scores.set(type, (scores.get(type) ?? 0) + level);
  }
  const ranked = HERO_TYPE_IDS.filter((type) => scores.has(type)).sort(
    (left, right) => (scores.get(right) ?? 0) - (scores.get(left) ?? 0),
  );
  const [primary, runnerUp] = ranked;
  if (primary === undefined) return [];
  if (runnerUp === undefined) return [primary];
  const primaryScore = scores.get(primary) ?? 0;
  const runnerUpScore = scores.get(runnerUp) ?? 0;
  return runnerUpScore >= primaryScore * SECOND_HERO_TYPE_SHARE ? [primary, runnerUp] : [primary];
}

export type WideBlastReading =
  | { readonly has: false }
  | { readonly has: true; readonly level: number };

/** Owned means in the hero's ability pool, a level-0 slot included — the badge says it is there. */
export function wideBlastOf(abilities: Readonly<Record<string, number>>): WideBlastReading {
  const level = abilities[WIDE_BLAST_ABILITY_ID];
  return level === undefined ? { has: false } : { has: true, level };
}

const TYPE_COPY_KEY = {
  crit: 'typeCrit',
  heavy: 'typeHeavy',
  pierce: 'typePierce',
  finish: 'typeFinish',
  gate: 'typeGate',
  loot: 'typeLoot',
  buff: 'typeBuff',
  endure: 'typeEndure',
} as const satisfies Record<HeroTypeId, keyof ShowcaseCopy>;

export function heroTypeLabel(type: HeroTypeId, copy: ShowcaseCopy): string {
  return copy[TYPE_COPY_KEY[type]];
}

/** The type line a card prints: both names, or the word for a hero with none. */
export function heroTypeLabels(types: readonly HeroTypeId[], copy: ShowcaseCopy): readonly string[] {
  return types.length === 0 ? [copy.typeNone] : types.map((type) => heroTypeLabel(type, copy));
}
