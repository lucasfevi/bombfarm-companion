import { ABILITIES, abilityMods, type AbilityEffect } from './model';
import {
  TEAM_AURA_SWITCH_IDS,
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_PER_LEVEL,
  type TeamAuraId,
  type TeamBuffId,
} from './team-buffs';

/**
 * An ability's effect as the combat model prices it, in the unit a reader can check against the
 * game: a percentage of attack, whole crit points, a damage multiplier. Keyed by what the effect
 * DOES rather than by ability id, so an ability added to the catalog under an existing kind gets
 * a readout without anyone touching this file.
 */
export type AbilityEffectReadout =
  | { kind: 'attackPct'; value: number }
  | { kind: 'speedPct'; value: number }
  | { kind: 'critPoints'; value: number }
  /** Positive = a reduction: 12 reads "−12% drain". */
  | { kind: 'drainPct'; value: number }
  | { kind: 'penetrationPoints'; value: number }
  | { kind: 'critDmgPct'; value: number }
  | { kind: 'rangeCells'; value: number }
  | { kind: 'dmgMult'; value: number }
  /** Contra o Relógio — attack that reaches the timed-gate table only. */
  | { kind: 'gateAttackPct'; value: number }
  /** Matilha — damage % PER ALLY beside the hero; the field size turns it into a multiplier. */
  | { kind: 'packDmgPctPerAlly'; value: number }
  /** Passagem de Bastão — TEAM damage % while the hero's entry pulse is up. */
  | { kind: 'teamPulseDmgPct'; value: number }
  | { kind: 'none' };

const ABILITY_BY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability]));
const TEAM_BUFF_IDS = new Set<string>(TEAM_BUFF_ABILITY_IDS);
const TEAM_AURA_IDS = new Set<string>(TEAM_AURA_SWITCH_IDS);

export function isTeamBuffId(abilityId: string): abilityId is TeamBuffId {
  return TEAM_BUFF_IDS.has(abilityId);
}

/** The standing five plus Passagem de Bastão — every aura a per-hero screen keeps behind a switch. */
export function isTeamAuraId(abilityId: string): abilityId is TeamAuraId {
  return TEAM_AURA_IDS.has(abilityId);
}

function readoutKind(effect: AbilityEffect): AbilityEffectReadout['kind'] {
  switch (effect.kind) {
    case 'attackPct':
      return 'attackPct';
    case 'speedPct':
      return 'speedPct';
    case 'critChanceFlat':
      return 'critPoints';
    case 'drainPct':
      return 'drainPct';
    case 'penetrationPp':
      return 'penetrationPoints';
    case 'critDmgFlat':
      return 'critDmgPct';
    case 'rangeCells':
      return 'rangeCells';
    case 'secondBlastPct':
    case 'executePct':
      return 'dmgMult';
    case 'gateAttackPct':
      return 'gateAttackPct';
    case 'packDmgPct':
      return 'packDmgPctPerAlly';
    case 'teamPulseDmgPct':
      return 'teamPulseDmgPct';
    case 'none':
      return 'none';
  }
}

/** A team aura at `amount` aura units (perLevel × rank, or a capped field total). */
export function teamAuraReadout(auraId: TeamAuraId, amount: number): AbilityEffectReadout {
  const definition = ABILITY_BY_ID.get(auraId);
  const kind = definition ? readoutKind(definition.effect) : 'none';
  return kind === 'none' ? { kind } : { kind, value: amount };
}

/**
 * One of the hero's own abilities at `rank`, read off `abilityMods` itself so the readout is the
 * model's own arithmetic and not a second copy of it. A team aura asked for here reads as its own
 * rank in aura units, since `abilityMods` deliberately carries none of them — Passagem de Bastão
 * included, whose pulse is priced over a stint rather than folded into the mods.
 */
export function ownAbilityReadout(abilityId: string, rank: number): AbilityEffectReadout {
  if (isTeamBuffId(abilityId)) return teamAuraReadout(abilityId, TEAM_BUFF_PER_LEVEL[abilityId] * rank);
  const definition = ABILITY_BY_ID.get(abilityId);
  if (!definition) return { kind: 'none' };
  const mods = abilityMods({ [abilityId]: rank });
  const kind = readoutKind(definition.effect);
  switch (kind) {
    case 'drainPct':
      return { kind, value: (1 - mods.drainMult) * 100 };
    case 'critPoints':
      return { kind, value: mods.sheetCritChanceFlat };
    case 'penetrationPoints':
      return { kind, value: mods.sheetPenetrationFlat };
    case 'critDmgPct':
      return { kind, value: mods.sheetCritDmgFlat };
    case 'rangeCells':
      return { kind, value: mods.rangeCells };
    case 'dmgMult':
      return { kind, value: mods.dmgMult };
    case 'gateAttackPct':
      return { kind, value: (mods.gateAttackMult - 1) * 100 };
    case 'packDmgPctPerAlly':
      return { kind, value: mods.packDmgPctPerAlly };
    case 'teamPulseDmgPct':
      return { kind, value: 'perLevel' in definition.effect ? definition.effect.perLevel * rank : 0 };
    case 'attackPct':
    case 'speedPct':
    case 'none':
      return { kind: 'none' };
  }
}
