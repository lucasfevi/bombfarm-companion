/**
 * The rows of the Abilities & auras section — what one hero's figures are priced with.
 *
 * Nothing here prices anything: `teamAurasAroundHero` says what each aura is worth from the
 * hero's seat, `teamAuraDpsDeltas` what flipping it would do, and `ownAbilityReadout` reads the
 * model's own arithmetic back. What lives here is the judgements the panel would otherwise take
 * inside JSX: which auras carry a switch, what the delta column is saying, which of the hero's
 * own abilities are in force on this phase.
 */
import {
  isPricedReadout,
  ownAbilityReadout,
  teamAuraReadout,
  isTeamAuraId,
  type AbilityEffectReadout,
} from '@bombfarm/domain/ability-effect-readout';
import { combineTeamAuraPct } from '@bombfarm/domain/derive';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  TEAM_AURA_SWITCH_IDS,
  teamAurasAroundHero,
  type TeamAuraSwitches,
  type TeamAuraId,
} from '@bombfarm/domain/team-buffs';

export type TeamAuraRow = {
  readonly buffId: TeamAuraId;
  /** The hero's own ability: on at the hero's rank, and no switch to turn it off. */
  readonly carried: boolean;
  readonly on: boolean;
  /**
   * What the figures are priced with while the aura is on — the hero's own rank, or the cap once
   * switched on — and what its switch would price them with while it is off: the cap.
   */
  readonly readout: AbilityEffectReadout;
  /** Signed percent of sustained DPS: "+x% if on" for an off aura, "−x% if off" for an on one. */
  readonly deltaPct: number;
};

export function teamAuraRowsFor(
  hero: Pick<HeroRecord, 'abilities'>,
  switches: TeamAuraSwitches,
  deltas: Record<TeamAuraId, number>,
): TeamAuraRow[] {
  const around = teamAurasAroundHero(hero, switches);
  return TEAM_AURA_SWITCH_IDS.map((buffId) => {
    const seat = around[buffId];
    return {
      buffId,
      carried: seat.carried,
      on: seat.on,
      readout: teamAuraReadout(buffId, seat.on ? combineTeamAuraPct(0, seat.pricedAt, seat.cap) : seat.cap),
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
  if (!isPricedReadout(effect)) return 'notModelled';
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
    .filter((entry) => entry.level > 0 && !isTeamAuraId(entry.id))
    .map((entry) => {
      const effect = ownAbilityReadout(entry.id, entry.level);
      return { abilityId: entry.id, rank: entry.level, effect, status: ownAbilityStatus(effect, gatePhase) };
    });
}
