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
 * Sums each team-wide ability's contribution (perLevel × level) across EVERY deployed hero,
 * excluding nobody — the aura is a property of the field (issue #132), so every hero standing
 * in it (carrier or not) experiences the same total. Returns the raw, UNCAPPED sum: the cap
 * ({@link TEAM_BUFF_CAP}) is applied once, at the combination site (`computeCombatMults`), not
 * here — storing the raw figure lets the UI field this feeds show the true total even when it
 * exceeds the cap, rather than silently rounding it off before the user ever sees it.
 */
export function computeTeamBuffsFromDeployed(heroes: HeroRecord[]): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  const contributors = heroes.filter((hero) => hero.deployed);
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    out[buffId] = contributors.reduce((total, hero) => total + perLevel * (hero.abilities[buffId] ?? 0), 0);
  }
  return out;
}

/**
 * Substitutes ONE hero's own contribution inside an already-computed roster total —
 * `total − oldRank×perLevel + newRank×perLevel` per aura — so a live editor preview can move
 * when the user changes THAT hero's own rank, without re-summing the whole roster and without
 * excluding anyone from the stored total itself (the old `excludeHeroId` design's defect: the
 * total two OTHER heroes read depended on which hero the exclusion happened to name). `oldAbilities`
 * is the hero's last-persisted ranks (as already counted in `total`); `newAbilities` is the
 * live-edited draft. Floors each aura at 0 — a `total` that was hand-typed, or computed before
 * the roster last changed, cannot be assumed to actually contain `oldAbilities`' contribution,
 * so the subtraction is not trusted to produce a negative result.
 */
export function substituteHeroAbilities(
  total: Record<TeamBuffId, number>,
  oldAbilities: Record<string, number>,
  newAbilities: Record<string, number>,
): Record<TeamBuffId, number> {
  const out = { ...total };
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    const oldContribution = perLevel * (oldAbilities[buffId] ?? 0);
    const newContribution = perLevel * (newAbilities[buffId] ?? 0);
    out[buffId] = Math.max(0, total[buffId] - oldContribution + newContribution);
  }
  return out;
}
