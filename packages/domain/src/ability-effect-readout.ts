import { ABILITIES, abilityMods, type AbilityEffect } from './model';
import {
  TEAM_AURA_SWITCH_IDS,
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_PER_LEVEL,
  type TeamAuraId,
  type TeamBuffId,
} from './team-buffs';

/**
 * An ability's effect at a rank, in the unit a reader can check against the game: a percentage
 * of attack, crit points, a second-blast chance and the multiplier it works out to. Keyed by what
 * the effect DOES rather than by ability id, so an ability added to the catalog under an existing
 * kind gets a readout without anyone touching this file. The modelled kinds are read off the
 * combat model's own arithmetic; the loot kinds the model never prices read off the catalog's
 * published per-level figure, so a card can still say what rank 20 buys.
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
  /** Detonação Dupla — the chance of a second blast, and the expected multiplier it amounts to. */
  | { kind: 'secondBlast'; chancePct: number; dmgMult: number }
  /** Misericórdia — the HP share below which a rock is executed, and the multiplier it amounts to. */
  | { kind: 'execute'; thresholdPct: number; dmgMult: number }
  /** Contra o Relógio — attack that reaches the timed-gate table only. */
  | { kind: 'gateAttackPct'; value: number }
  /** Matilha — damage % PER ALLY beside the hero; the field size turns it into a multiplier. */
  | { kind: 'packDmgPctPerAlly'; value: number }
  /** Passagem de Bastão — TEAM damage % while the hero's entry pulse is up. */
  | { kind: 'teamPulseDmgPct'; value: number }
  /** Caça-Hero — damage against a Cage. */
  | { kind: 'cageDmgPct'; value: number }
  /** Fantasma — attack while passing through rock. */
  | { kind: 'passageAttackPct'; value: number }
  /** Olho de Lapidador — the chance a drop comes up one rarity. */
  | { kind: 'dropTierPct'; value: number }
  /** Veia de Ouro (own) and Fortuna (TEAM) — gold. */
  | { kind: 'goldPct'; value: number }
  | { kind: 'none' };

/**
 * The per-level figure of every ability the combat model does not price, as the wiki publishes
 * it — loot and cage effects the farm board prices elsewhere or not at all. A test holds each
 * figure against the ability's own effect text, so the two cannot drift apart.
 */
type UnmodelledReadoutKind = 'cageDmgPct' | 'passageAttackPct' | 'dropTierPct' | 'goldPct';

const UNMODELLED_PER_LEVEL: Record<string, { kind: UnmodelledReadoutKind; perLevel: number }> = {
  caca_hero: { kind: 'cageDmgPct', perLevel: 5 },
  fantasma: { kind: 'passageAttackPct', perLevel: 0.05 },
  olho_lapidador: { kind: 'dropTierPct', perLevel: 2.5 },
  veia_ouro: { kind: 'goldPct', perLevel: 2 },
  fortuna: { kind: 'goldPct', perLevel: 0.5 },
};

export const UNMODELLED_READOUT_PER_LEVEL: Readonly<typeof UNMODELLED_PER_LEVEL> = UNMODELLED_PER_LEVEL;

const UNMODELLED_KINDS = new Set<AbilityEffectReadout['kind']>(['none', 'cageDmgPct', 'passageAttackPct', 'dropTierPct', 'goldPct']);

/** Whether the combat model prices this readout, or merely repeats a figure the wiki publishes. */
export function isPricedReadout(readout: AbilityEffectReadout): boolean {
  return !UNMODELLED_KINDS.has(readout.kind);
}

const ABILITY_BY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability]));
const TEAM_BUFF_IDS = new Set<string>(TEAM_BUFF_ABILITY_IDS);
const TEAM_AURA_IDS = new Set<string>(TEAM_AURA_SWITCH_IDS);

/**
 * Every ability the game scopes to the TEAM: the switched auras plus Fortuna, a team gold aura the
 * combat model never prices (loot is the farm board's layer), so it belongs to no switch list.
 */
export const TEAM_ABILITY_IDS = [...TEAM_AURA_SWITCH_IDS, 'fortuna'] as const;

export type TeamAbilityId = (typeof TEAM_ABILITY_IDS)[number];

const TEAM_ABILITY_ID_SET = new Set<string>(TEAM_ABILITY_IDS);

export function isTeamBuffId(abilityId: string): abilityId is TeamBuffId {
  return TEAM_BUFF_IDS.has(abilityId);
}

/** The standing five plus Passagem de Bastão — every aura a per-hero screen keeps behind a switch. */
export function isTeamAuraId(abilityId: string): abilityId is TeamAuraId {
  return TEAM_AURA_IDS.has(abilityId);
}

/** Whether the ability acts on the whole team rather than its carrier — the tag a card shows. */
export function isTeamAbilityId(abilityId: string): abilityId is TeamAbilityId {
  return TEAM_ABILITY_ID_SET.has(abilityId);
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
      return 'secondBlast';
    case 'executePct':
      return 'execute';
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
  if (kind === 'none' || kind === 'secondBlast' || kind === 'execute') return { kind: 'none' };
  return { kind, value: amount };
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
    case 'secondBlast':
      return { kind, chancePct: perLevelOf(definition.effect) * rank, dmgMult: mods.dmgMult };
    case 'execute':
      return { kind, thresholdPct: perLevelOf(definition.effect) * rank, dmgMult: mods.dmgMult };
    case 'gateAttackPct':
      return { kind, value: (mods.gateAttackMult - 1) * 100 };
    case 'packDmgPctPerAlly':
      return { kind, value: mods.packDmgPctPerAlly };
    case 'teamPulseDmgPct':
      return { kind, value: perLevelOf(definition.effect) * rank };
    case 'none': {
      const published = UNMODELLED_PER_LEVEL[abilityId];
      return published ? { kind: published.kind, value: published.perLevel * rank } : { kind: 'none' };
    }
    case 'attackPct':
    case 'speedPct':
    case 'cageDmgPct':
    case 'passageAttackPct':
    case 'dropTierPct':
    case 'goldPct':
      return { kind: 'none' };
  }
}

function perLevelOf(effect: AbilityEffect): number {
  return 'perLevel' in effect ? effect.perLevel : 0;
}
