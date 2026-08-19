import { ABILITIES } from './model';
import type { HeroRecord } from './shims/storage';

export const TEAM_BUFF_ABILITY_IDS = [
  'grito_guerra',
  'pressagio_mortal',
  'marcha_acelerada',
  'folego_mineiro',
  'contra_relogio',
] as const;

export type TeamBuffId = (typeof TEAM_BUFF_ABILITY_IDS)[number];

/**
 * `ABILITIES` lookup for the five team buffs, resolved once at module load.
 *
 * The linear `ABILITIES.find` this replaces ran per buff id per aura computation — 14% of a
 * team-plan run's CPU by profile, since `computeRosterAuras` is called once per hero per
 * fixed-point round per roster evaluation. `ABILITIES` is a frozen catalog, so hoisting is a
 * pure lookup change: same values, same order, same arithmetic.
 */
export const TEAM_BUFF_PER_LEVEL: Record<TeamBuffId, number> = Object.fromEntries(
  TEAM_BUFF_ABILITY_IDS.map((buffId) => {
    const definition = ABILITIES.find((ability) => ability.id === buffId);
    return [buffId, definition && 'perLevel' in definition.effect ? definition.effect.perLevel : 0];
  }),
) as Record<TeamBuffId, number>;

export function zeroTeamBuffs(): Record<TeamBuffId, number> {
  return {
    grito_guerra: 0,
    pressagio_mortal: 0,
    marcha_acelerada: 0,
    folego_mineiro: 0,
    contra_relogio: 0,
  };
}

/** UI metadata for team-buff number fields (labels / hints / steps). */
export const TEAM_BUFF_FIELDS = [
  { id: 'grito_guerra', label: 'Grito de Guerra', hint: 'Atk %', step: 1 },
  { id: 'pressagio_mortal', label: 'Presságio Mortal', hint: 'Crit % base', step: 1 },
  { id: 'marcha_acelerada', label: 'Marcha Acelerada', hint: 'Speed %', step: 0.1 },
  { id: 'folego_mineiro', label: 'Fôlego de Mineiro', hint: 'Drain −%', step: 1 },
  { id: 'contra_relogio', label: 'Contra o Relógio', hint: 'Gate Atk %', step: 1 },
] as const satisfies readonly { id: TeamBuffId; label: string; hint: string; step: number }[];

/**
 * Sums each team-wide ability's contribution (perLevel × level) across every
 * deployed hero except the one currently being edited — that hero's own copy
 * still applies via abilityMods(), and computeCombatMults stacks own + others
 * additively (capped +100%), matching in-game team skill bonuses.
 */
export function computeTeamBuffsFromDeployed(
  heroes: HeroRecord[],
  excludeHeroId: string | null,
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  const contributors = heroes.filter((hero) => hero.deployed && hero.id !== excludeHeroId);
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    out[buffId] = contributors.reduce((sum, hero) => sum + perLevel * (hero.abilities[buffId] ?? 0), 0);
  }
  return out;
}
