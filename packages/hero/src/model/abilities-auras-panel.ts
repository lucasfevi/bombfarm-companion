/**
 * The rows of the Abilities & auras section — what one hero's figures are priced with.
 *
 * Nothing here prices anything: `teamAurasAroundHero` says what each aura is worth from the
 * hero's seat, `teamAuraDpsDeltas` what flipping it would do, and `ownAbilityReadout` reads the
 * model's own arithmetic back. What lives here is the judgements the panel would otherwise take
 * inside JSX: which auras carry a switch, what the delta column is saying, which of the hero's
 * own abilities are in force on this phase, and how the two drain reductions add.
 */
import {
  ownAbilityReadout,
  teamAuraReadout,
  isTeamBuffId,
  type AbilityEffectReadout,
} from '@bombfarm/domain/ability-effect-readout';
import { combineTeamAuraPct } from '@bombfarm/domain/derive';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  TEAM_BUFF_ABILITY_IDS,
  teamAurasAroundHero,
  type TeamAuraSwitches,
  type TeamBuffId,
} from '@bombfarm/domain/team-buffs';

export type TeamAuraRow = {
  readonly buffId: TeamBuffId;
  /** The hero's own ability: on at the hero's rank, and no switch to turn it off. */
  readonly carried: boolean;
  readonly on: boolean;
  /** What the figures are priced with, capped — `null` while the aura is off. */
  readonly pricedAt: AbilityEffectReadout | null;
  readonly cap: AbilityEffectReadout;
  /** Signed percent of sustained DPS: "+x% if on" for an off aura, "−x% if off" for an on one. */
  readonly deltaPct: number;
};

export function teamAuraRowsFor(
  hero: Pick<HeroRecord, 'abilities'>,
  switches: TeamAuraSwitches,
  deltas: Record<TeamBuffId, number>,
): TeamAuraRow[] {
  const around = teamAurasAroundHero(hero, switches);
  return TEAM_BUFF_ABILITY_IDS.map((buffId) => {
    const seat = around[buffId];
    return {
      buffId,
      carried: seat.carried,
      on: seat.on,
      pricedAt: seat.on ? teamAuraReadout(buffId, combineTeamAuraPct(0, seat.pricedAt, seat.cap)) : null,
      cap: teamAuraReadout(buffId, seat.cap),
      deltaPct: deltas[buffId] ?? 0,
    };
  });
}

/**
 * `own` — priced into every figure. `notHere` — modelled, but the phase does not trigger it
 * (Contra o Relógio off a gate phase). `notModelled` — the model carries no effect for it.
 */
export type OwnAbilityStatus = 'own' | 'notHere' | 'notModelled';

export type OwnAbilityRow = {
  readonly abilityId: string;
  readonly rank: number;
  readonly effect: AbilityEffectReadout;
  readonly status: OwnAbilityStatus;
};

function ownAbilityStatus(effect: AbilityEffectReadout, gatePhase: boolean): OwnAbilityStatus {
  if (effect.kind === 'none') return 'notModelled';
  if (effect.kind === 'gateAttackPct') return gatePhase ? 'own' : 'notHere';
  return 'own';
}

/**
 * Every ability the hero has a rank in, its team auras excepted — those are rows of the aura
 * group above, tagged as the hero's own. Ordered as the save lists the hero's pool.
 */
export function ownAbilityRowsFor(hero: Pick<HeroRecord, 'abilities'>, phase: number): OwnAbilityRow[] {
  const gatePhase = wikiPhaseLine(phase)?.gate === true;
  return heroAbilityIconEntries(hero.abilities)
    .filter((entry) => entry.level > 0 && !isTeamBuffId(entry.id))
    .map((entry) => {
      const effect = ownAbilityReadout(entry.id, entry.level);
      return { abilityId: entry.id, rank: entry.level, effect, status: ownAbilityStatus(effect, gatePhase) };
    });
}

export type DrainNote = { readonly own: number; readonly team: number; readonly total: number };

/**
 * The two drain reductions and their sum, in percent: Bateria Extra's on the hero and Fôlego's
 * on the field add, so −12% own and −20% team make −32% — a reader who sees the two as one
 * thing would otherwise expect −30% or −29%.
 */
export function drainNoteFor(hero: Pick<HeroRecord, 'abilities'>, switches: TeamAuraSwitches): DrainNote {
  const own = ownAbilityReadout('bateria_extra', hero.abilities.bateria_extra ?? 0);
  const folego = teamAurasAroundHero(hero, switches).folego_mineiro;
  const ownPct = own.kind === 'drainPct' ? own.value : 0;
  const teamPct = folego.on ? combineTeamAuraPct(0, folego.pricedAt, folego.cap) : 0;
  return { own: ownPct, team: teamPct, total: ownPct + teamPct };
}
