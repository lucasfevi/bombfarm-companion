/**
 * The judgements the combat breakdown panel would otherwise take inside JSX: which cards sit in
 * which row, which card feeds which, which ability lands on which card, how a sheet stat's ledger
 * folds into the matrix's game lines, and which note a card carries.
 *
 * Nothing here prices anything — `buildStatBreakdown` and `rowValue` do, and every figure the
 * panel prints is theirs.
 */
import { ABILITIES, FUSE_FLOOR, STAT_CAPS, critFactor, fuseSeconds, type AbilityEffect } from '@bombfarm/domain/model';
import { combineDrainRate } from '@bombfarm/domain/drain';
import { abilityName } from '@bombfarm/domain/game-labels';
import { SHEET_DISPLAY_KEYS, type SheetDisplayKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  buildStatBreakdown,
  LEDGER_SOURCE_GROUP,
  type BreakdownStatId,
  type LedgerGroup,
  type LedgerSource,
  type LedgerStep,
  type PipelineFacts,
  type StatBreakdown,
} from '@bombfarm/domain/stat-breakdown';
import { TEAM_AURA_SWITCH_IDS, teamAurasAroundHero, type TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import type { Lang } from '../copy';
import { ownAbilityRowsFor } from './abilities-auras-panel';
import { penetrationReadingFor, type PenetrationReading } from './combat-panel';

export type BreakdownRowId = 'sheet' | 'factors' | 'perHit' | 'dps';

export type BreakdownRow = { readonly id: BreakdownRowId; readonly cards: readonly BreakdownStatId[] };

export const COMBAT_BREAKDOWN_ROWS: readonly BreakdownRow[] = [
  { id: 'sheet', cards: SHEET_DISPLAY_KEYS },
  { id: 'factors', cards: ['dmg', 'mitF', 'critFactor', 'fuse', 'fieldSeconds', 'rest'] },
  { id: 'perHit', cards: ['hit', 'criticalHit', 'avgHit', 'bombsPerSecond', 'uptime'] },
  { id: 'dps', cards: ['activeDps', 'sustainedDps'] },
];

export const COMBAT_BREAKDOWN_CARDS: readonly BreakdownStatId[] = COMBAT_BREAKDOWN_ROWS.flatMap((row) => row.cards);

export type BreakdownEdge = { readonly from: BreakdownStatId; readonly to: BreakdownStatId };

/** One edge per card input that is itself a card — the formulas fix these, not a layout choice. */
export const COMBAT_BREAKDOWN_EDGES: readonly BreakdownEdge[] = [
  { from: 'penetration', to: 'mitF' },
  { from: 'critChance', to: 'critFactor' },
  { from: 'critDmg', to: 'critFactor' },
  { from: 'cdr', to: 'fuse' },
  { from: 'energy', to: 'fieldSeconds' },
  { from: 'attack', to: 'hit' },
  { from: 'mitF', to: 'hit' },
  { from: 'dmg', to: 'hit' },
  { from: 'hit', to: 'criticalHit' },
  { from: 'critDmg', to: 'criticalHit' },
  { from: 'hit', to: 'avgHit' },
  { from: 'critFactor', to: 'avgHit' },
  { from: 'fuse', to: 'bombsPerSecond' },
  { from: 'speed', to: 'bombsPerSecond' },
  { from: 'fieldSeconds', to: 'uptime' },
  { from: 'rest', to: 'uptime' },
  { from: 'avgHit', to: 'activeDps' },
  { from: 'bombsPerSecond', to: 'activeDps' },
  { from: 'activeDps', to: 'sustainedDps' },
  { from: 'uptime', to: 'sustainedDps' },
];

export function cardInputs(card: BreakdownStatId): readonly BreakdownStatId[] {
  return COMBAT_BREAKDOWN_EDGES.filter((edge) => edge.to === card).map((edge) => edge.from);
}

/**
 * Where each effect kind lands. Exhaustive over the catalog's kinds, so an ability added under a
 * new kind has to be placed here before it compiles — and one added under an existing kind lands
 * on the right card without anyone touching this file.
 */
const CARD_FOR_EFFECT: Record<AbilityEffect['kind'], BreakdownStatId | null> = {
  attackPct: 'attack',
  gateAttackPct: 'attack',
  speedPct: 'speed',
  critChanceFlat: 'critChance',
  critDmgFlat: 'critDmg',
  penetrationPp: 'penetration',
  drainPct: 'fieldSeconds',
  rangeCells: 'activeDps',
  secondBlastPct: 'dmg',
  executePct: 'dmg',
  packDmgPct: 'dmg',
  teamPulseDmgPct: 'dmg',
  none: null,
};

const ABILITY_BY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability]));

export function cardForAbility(abilityId: string): BreakdownStatId | null {
  const definition = ABILITY_BY_ID.get(abilityId);
  return definition ? CARD_FOR_EFFECT[definition.effect.kind] : null;
}

export type CardBadge = {
  readonly abilityId: string;
  /** Off: a team aura whose switch is off, or the hero's own aura at rank 0. */
  readonly on: boolean;
};

/**
 * The icons at each card's bottom edge: every team aura the game has (dimmed while its switch is
 * off), and every ability of the hero's own that is in force on this phase. Cards are listed in
 * pipeline order; a card nothing reaches has no entry.
 */
export function cardBadgesFor(
  hero: Pick<HeroRecord, 'abilities'>,
  phase: number,
  switches: TeamAuraSwitches,
): ReadonlyMap<BreakdownStatId, readonly CardBadge[]> {
  const badges = new Map<BreakdownStatId, CardBadge[]>();
  const place = (abilityId: string, on: boolean) => {
    const card = cardForAbility(abilityId);
    if (!card) return;
    const list = badges.get(card) ?? [];
    list.push({ abilityId, on });
    badges.set(card, list);
  };
  const seats = teamAurasAroundHero(hero, switches);
  for (const auraId of TEAM_AURA_SWITCH_IDS) place(auraId, seats[auraId].on);
  for (const row of ownAbilityRowsFor(hero, phase)) {
    if (row.status === 'own') place(row.abilityId, true);
  }
  return badges;
}

export type LedgerLine = {
  readonly group: LedgerGroup;
  /** The first step's source — what names the line. */
  readonly source: LedgerSource;
  readonly steps: readonly LedgerStep[];
  /** The running total once the line's last step has applied. */
  readonly running: number;
};

/** A sheet stat's ledger with consecutive steps of one game line folded together. */
export function ledgerLines(steps: readonly LedgerStep[]): LedgerLine[] {
  const lines: { group: LedgerGroup; source: LedgerSource; steps: LedgerStep[]; running: number }[] = [];
  for (const step of steps) {
    const group = LEDGER_SOURCE_GROUP[step.source];
    const last = lines.at(-1);
    if (last && last.group === group) {
      last.steps.push(step);
      last.running = step.running;
    } else {
      lines.push({ group, source: step.source, steps: [step], running: step.running });
    }
  }
  return lines;
}

export type MatrixCell =
  | { readonly kind: 'step'; readonly step: LedgerStep }
  | { readonly kind: 'off' }
  | { readonly kind: 'none' };

export type MatrixRow = {
  readonly key: SheetDisplayKey;
  /** base · level · stars · points folded to one figure; the steps behind it, for the hover. */
  readonly hero: { readonly value: number; readonly steps: readonly LedgerStep[] };
  readonly gear: MatrixCell;
  readonly ability: MatrixCell;
  readonly skillTree: MatrixCell;
  readonly rune: MatrixCell;
  readonly sheetTotal: number;
  readonly aura: MatrixCell;
  readonly effective: number;
};

function singleStep(steps: readonly LedgerStep[], group: LedgerGroup): MatrixCell {
  const step = steps.find((candidate) => LEDGER_SOURCE_GROUP[candidate.source] === group);
  return step ? { kind: 'step', step } : { kind: 'none' };
}

/** The Hero line's steps are not consecutive — the game inserts gear and the tree before the
 *  points — so its figure is folded from the steps alone rather than read off a running total. */
function heroFigure(steps: readonly LedgerStep[]): number {
  let value = 0;
  for (const step of steps) {
    if (LEDGER_SOURCE_GROUP[step.source] !== 'hero') continue;
    value = step.op === '×' ? value * step.amount : value + step.amount;
  }
  return value;
}

function auraCell(key: SheetDisplayKey, steps: readonly LedgerStep[], auraOn: boolean): MatrixCell {
  const step = steps.find((candidate) => LEDGER_SOURCE_GROUP[candidate.source] === 'combat');
  if (step) return { kind: 'step', step };
  const reached = TEAM_AURA_SWITCH_IDS.some((buffId) => cardForAbility(buffId) === key);
  if (!reached) return { kind: 'none' };
  return auraOn ? { kind: 'none' } : { kind: 'off' };
}

export function matrixRowsFor(
  facts: PipelineFacts,
  hero: Pick<HeroRecord, 'abilities'>,
  switches: TeamAuraSwitches,
): MatrixRow[] {
  const seats = teamAurasAroundHero(hero, switches);
  return SHEET_DISPLAY_KEYS.map((key) => {
    const breakdown = buildStatBreakdown(key, facts);
    const steps = breakdown.kind === 'ledger' ? breakdown.steps : [];
    const auraOn = TEAM_AURA_SWITCH_IDS.some((buffId) => cardForAbility(buffId) === key && seats[buffId].on);
    return {
      key,
      hero: {
        value: heroFigure(steps),
        steps: steps.filter((step) => LEDGER_SOURCE_GROUP[step.source] === 'hero'),
      },
      gear: singleStep(steps, 'gear'),
      ability: singleStep(steps, 'ability'),
      skillTree: singleStep(steps, 'skillTree'),
      rune: singleStep(steps, 'rune'),
      sheetTotal: facts.adjusted[key],
      aura: auraCell(key, steps, auraOn),
      effective: facts.effective[key],
    };
  });
}

/** The Rune column is drawn only while a rune is on the sheet — a column of dashes says nothing. */
export function matrixShowsRunes(rows: readonly MatrixRow[]): boolean {
  return rows.some((row) => row.rune.kind === 'step');
}

export type PenetrationCardReading = PenetrationReading;

export function penetrationCardReading(facts: PipelineFacts): PenetrationCardReading {
  return penetrationReadingFor(facts);
}

export type CardNote =
  | { readonly kind: 'fuseAtCeiling'; readonly floorSecs: number; readonly capPct: number }
  | { readonly kind: 'fuseFloor'; readonly floorSecs: number; readonly capPct: number }
  | { readonly kind: 'avgHitEqualsHit' }
  | { readonly kind: 'fieldWithoutTeamDrain'; readonly auraId: string; readonly seconds: number }
  | { readonly kind: 'batonHeld'; readonly pct: number }
  | { readonly kind: 'activeDpsConstants'; readonly rangeCells: number }
  | { readonly kind: 'penetration'; readonly reading: PenetrationCardReading };

/** What the model has to say about a card beyond its formula, when it has something. */
export function cardNoteFor(
  card: BreakdownStatId,
  facts: PipelineFacts,
  hero: Pick<HeroRecord, 'abilities'>,
  switches: TeamAuraSwitches,
): CardNote | null {
  switch (card) {
    case 'fuse': {
      const atCeiling = fuseSeconds(facts.effective.cdr) <= FUSE_FLOOR;
      return { kind: atCeiling ? 'fuseAtCeiling' : 'fuseFloor', floorSecs: FUSE_FLOOR, capPct: STAT_CAPS.cdr };
    }
    case 'avgHit':
      return critFactor(facts.effective.critChance, facts.effective.critDmg) === 1
        ? { kind: 'avgHitEqualsHit' }
        : null;
    case 'fieldSeconds': {
      const folego = teamAurasAroundHero(hero, switches).folego_mineiro;
      if (!folego.on) return null;
      const seconds = facts.effective.energy / combineDrainRate(facts.mods.drainMult, 1);
      return { kind: 'fieldWithoutTeamDrain', auraId: 'folego_mineiro', seconds };
    }
    case 'dmg': {
      const pulse = facts.entryPulseMult ?? 1;
      return pulse > 1 ? { kind: 'batonHeld', pct: (pulse - 1) * 100 } : null;
    }
    case 'activeDps':
      return { kind: 'activeDpsConstants', rangeCells: facts.context.blastRange };
    case 'mitF':
      return { kind: 'penetration', reading: penetrationCardReading(facts) };
    default:
      return null;
  }
}

export type CardInputChip = {
  readonly label: string;
  /** Dimmed: an aura that could reach the card but is switched off. */
  readonly on: boolean;
};

/** What a card reads, as chips: the cards that feed it, then the abilities that land on it. */
export function cardInputChips(
  card: BreakdownStatId,
  cardLabel: (id: BreakdownStatId) => string,
  badges: ReadonlyMap<BreakdownStatId, readonly CardBadge[]>,
  lang: Lang,
): CardInputChip[] {
  const fromCards = cardInputs(card).map((id) => ({ label: cardLabel(id), on: true }));
  const fromAbilities = (badges.get(card) ?? []).map((badge) => ({
    label: abilityName(badge.abilityId, lang),
    on: badge.on,
  }));
  return [...fromCards, ...fromAbilities];
}

export type BreakdownCardData = {
  readonly id: BreakdownStatId;
  readonly breakdown: StatBreakdown;
  readonly badges: readonly CardBadge[];
  readonly chips: readonly CardInputChip[];
  readonly note: CardNote | null;
};

/** Everything one card draws from the model, gathered once so the card itself only formats. */
export function breakdownCardData(
  id: BreakdownStatId,
  facts: PipelineFacts,
  hero: Pick<HeroRecord, 'abilities'>,
  switches: TeamAuraSwitches,
  badges: ReadonlyMap<BreakdownStatId, readonly CardBadge[]>,
  cardLabel: (card: BreakdownStatId) => string,
  lang: Lang,
): BreakdownCardData {
  return {
    id,
    breakdown: buildStatBreakdown(id, facts),
    badges: badges.get(id) ?? [],
    chips: cardInputChips(id, cardLabel, badges, lang),
    note: cardNoteFor(id, facts, hero, switches),
  };
}
