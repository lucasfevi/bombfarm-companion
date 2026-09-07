/**
 * What one more level of each of a hero's abilities is worth to THAT hero, at THAT phase.
 *
 * ONE MODEL, NOT TWO. Every figure here is a difference of two `pipelineForHero` runs — the
 * hero as stored, and a copy with one ability level added. There is deliberately no analytic
 * formula for "an ability level is worth X%": a second model of the same quantity drifts from
 * the first the moment either is corrected, and the drift is invisible because both keep
 * returning plausible numbers.
 *
 * The gain is a percentage change in SUSTAINED DPS (`AdvisorPipelineResult.dps`), which is the
 * quantity `rankNextPoint` scores a stat point on and reports as `PointValue.gainPct`. The two
 * are therefore on one scale: an ability level and a stat point can be compared directly.
 *
 * PRECONDITION — BIRTH-BACKED HEROES ONLY. `resolveDeriveSheets` recomposes a hero's naked and
 * geared sheets from its birth roll and its ability mods only when `hero.birth` is present;
 * without it the pipeline projects the hero's OBSERVED sheet, which already has the current
 * ability levels baked in and cannot be recomposed from a different set. Bumping an ability on
 * such a hero moves nothing, so every entry would read as a gain of exactly zero — which is
 * indistinguishable from "every ability on this hero is worthless". A hero with no birth roll
 * gets {@link AbilityGainState} `unavailable` for every ability instead.
 *
 * TEAM AURAS ARE SUBSTITUTED, NOT BUMPED. `abilityMods` never folds a team aura into a hero's
 * own mods — `computeCombatMults` reads all four only from the roster-wide total — so raising
 * `grito_guerra` on the hero record alone produces a byte-identical run. Each priced level is
 * therefore applied to the account's aura total too, via `substituteHeroAbilities`, which is the
 * real benefit the carrier receives: the aura is a property of the field and its carrier stands
 * in the field. Where the roster total is already at that aura's ceiling the next level genuinely
 * buys nothing, and that TRUE zero gets its own state rather than a gain of 0.
 *
 * Pure and uncached — roughly one model run per ability. Memoisation belongs to the caller.
 */
import { combineTeamAuraPct } from './derive';
import { heroAbilityIconEntries } from './hero-abilities';
import { ABILITIES } from './model';
import { pipelineForHero } from './roster-dps';
import { TEAM_BUFF_ABILITY_IDS, TEAM_BUFF_CAP, substituteHeroAbilities, type TeamBuffId } from './team-buffs';
import type { AccountShared, HeroRecord } from './shims/storage';

export type AbilityGainUnavailableReason = 'no-birth-roll';

export type AbilityGainState =
  /** One more level is worth this much sustained DPS, in percent — `PointValue.gainPct` units. */
  | { kind: 'gain'; gainPct: number }
  /** Already at the ability's maximum level; there is no next level to buy. */
  | { kind: 'maxed' }
  /** The combat model carries no effect for this ability, so it cannot be priced at all. */
  | { kind: 'notModelled' }
  /** A team aura whose field-wide ceiling the roster total has already reached. */
  | { kind: 'auraAtCeiling' }
  | { kind: 'unavailable'; reason: AbilityGainUnavailableReason };

export type AbilityGain = {
  abilityId: string;
  level: number;
  max: number;
  state: AbilityGainState;
};

type AbilityEntry = { id: string; level: number; max: number };

type PricedBump =
  | { kind: 'settled'; state: AbilityGainState }
  | { kind: 'price'; hero: HeroRecord; account: AccountShared };

const EFFECT_KIND_BY_ABILITY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability.effect.kind]));
const TEAM_BUFF_IDS = new Set<string>(TEAM_BUFF_ABILITY_IDS);

function isTeamBuffId(abilityId: string): abilityId is TeamBuffId {
  return TEAM_BUFF_IDS.has(abilityId);
}

function cappedAura(totals: Record<string, number>, buffId: TeamBuffId): number {
  return combineTeamAuraPct(0, totals[buffId] ?? 0, TEAM_BUFF_CAP[buffId]);
}

function planBump(entry: AbilityEntry, hero: HeroRecord, account: AccountShared): PricedBump {
  if (entry.level >= entry.max) return { kind: 'settled', state: { kind: 'maxed' } };
  if (EFFECT_KIND_BY_ABILITY_ID.get(entry.id) === 'none') {
    return { kind: 'settled', state: { kind: 'notModelled' } };
  }

  const abilities = { ...hero.abilities, [entry.id]: entry.level + 1 };
  const teamBuffs = substituteHeroAbilities(account.teamBuffs, hero.abilities, abilities);
  if (isTeamBuffId(entry.id) && cappedAura(teamBuffs, entry.id) <= cappedAura(account.teamBuffs, entry.id)) {
    return { kind: 'settled', state: { kind: 'auraAtCeiling' } };
  }

  return { kind: 'price', hero: { ...hero, abilities }, account: { ...account, teamBuffs } };
}

function gainPctOf(bumpedDps: number, baselineDps: number): number {
  return baselineDps > 0 ? (bumpedDps / baselineDps - 1) * 100 : 0;
}

/**
 * One entry per ability in the hero's pool, including its unspent (level 0) slots, in the order
 * `heroAbilityIconEntries` lists them.
 */
export function abilityGainFor(
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
): AbilityGain[] {
  const entries = heroAbilityIconEntries(hero.abilities);
  if (!hero.birth) {
    return entries.map((entry) => ({
      abilityId: entry.id,
      level: entry.level,
      max: entry.max,
      state: { kind: 'unavailable', reason: 'no-birth-roll' },
    }));
  }

  const plans = entries.map((entry) => ({ entry, bump: planBump(entry, hero, account) }));
  const baselineDps = plans.some((plan) => plan.bump.kind === 'price')
    ? pipelineForHero(hero, account, phase, mitigationPct).dps
    : 0;

  return plans.map(({ entry, bump }) => ({
    abilityId: entry.id,
    level: entry.level,
    max: entry.max,
    state:
      bump.kind === 'settled'
        ? bump.state
        : {
            kind: 'gain',
            gainPct: gainPctOf(
              pipelineForHero(bump.hero, bump.account, phase, mitigationPct).dps,
              baselineDps,
            ),
          },
  }));
}
