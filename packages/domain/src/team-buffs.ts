import { ABILITIES } from './model';
import type { HeroRecord } from './shims/storage';

/**
 * The team auras this planner MODELS — not every `team_*`-kind ability the wiki lists.
 * `contra_relogio` ("Contra o Relógio") is excluded on purpose: the wiki's own `kind` prefix
 * (`gate_power`, not `team_*`), its "Só ele" scope column, and this catalog's `effectText`
 * (missing the "do TIME" every genuine aura below carries) all agree it is self-scoped, not a
 * team aura. `fortuna`/`brecha` are genuine `team_gold`/`team_pen` auras missing from this list,
 * but both carry `effect: { kind: 'none' }` (BSP-47/ASM-06) and nothing downstream reads them —
 * adding them here would be new modelling, not a fix.
 */
export const TEAM_BUFF_ABILITY_IDS = [
  'grito_guerra',
  'pressagio_mortal',
  'marcha_acelerada',
  'folego_mineiro',
] as const;

export type TeamBuffId = (typeof TEAM_BUFF_ABILITY_IDS)[number];

/**
 * `ABILITIES` lookup for the four team buffs, resolved once at module load.
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

/**
 * Each aura's own maximum — the confirmed field-wide cap every carrier's COMBINED rank clamps
 * at (two rank-20 Fôlego carriers give -20%, same as one rank-20 carrier alone). For these four
 * abilities this equals `max rank (20) × perLevel`, but is stored as a literal per ability
 * rather than computed from that formula: `matilha`'s published cap
 * (`combate.pack_dmg_cap: 0.9`) does NOT follow it, so `max × perLevel` is a reading, not a law
 * safe to lean on for an ability not yet checked against the wiki's own cap field.
 */
export const TEAM_BUFF_CAP: Record<TeamBuffId, number> = {
  grito_guerra: 20,
  pressagio_mortal: 114.28571428571428,
  marcha_acelerada: 3.7,
  folego_mineiro: 20,
};

export function zeroTeamBuffs(): Record<TeamBuffId, number> {
  return {
    grito_guerra: 0,
    pressagio_mortal: 0,
    marcha_acelerada: 0,
    folego_mineiro: 0,
  };
}

/** UI metadata for team-buff number fields (labels / hints / steps). */
export const TEAM_BUFF_FIELDS = [
  { id: 'grito_guerra', label: 'Grito de Guerra', hint: 'Atk %', step: 1 },
  { id: 'pressagio_mortal', label: 'Presságio Mortal', hint: 'Crit % base', step: 1 },
  { id: 'marcha_acelerada', label: 'Marcha Acelerada', hint: 'Speed %', step: 0.1 },
  { id: 'folego_mineiro', label: 'Fôlego de Mineiro', hint: 'Drain −%', step: 1 },
] as const satisfies readonly { id: TeamBuffId; label: string; hint: string; step: number }[];

/**
 * Sums each team-wide ability's contribution (perLevel × level) across every deployed hero
 * except the one currently being edited, clamped at that aura's own cap ({@link TEAM_BUFF_CAP}).
 * The excluded hero's own copy still applies via `abilityMods()` — the combination site
 * (`computeCombatMults`) adds it back to this total and clamps the COMBINED figure again, so
 * clamping here only keeps this function's own return value (and the autofilled UI field it
 * feeds) from reading past the cap on its own.
 */
export function computeTeamBuffsFromDeployed(
  heroes: HeroRecord[],
  excludeHeroId: string | null,
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  const contributors = heroes.filter((hero) => hero.deployed && hero.id !== excludeHeroId);
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    const sum = contributors.reduce((total, hero) => total + perLevel * (hero.abilities[buffId] ?? 0), 0);
    out[buffId] = Math.min(TEAM_BUFF_CAP[buffId], sum);
  }
  return out;
}
