/**
 * The presentation decisions the abilities panel makes ON TOP of `abilityGainFor`.
 *
 * Nothing here re-prices an ability — the domain owns that, from one model. What lives here is
 * every judgement the panel would otherwise take inside JSX, where no test in this repository can
 * reach it: which of the six gain states a row is stating, whether this hero holds points it can
 * never spend, and whether there is an ability list to draw at all.
 */
import type { AbilityGain, AbilityGainState } from '@bombfarm/domain/ability-gain';
import { heroAbilitySlotsUsed } from '@bombfarm/domain/hero-abilities';
import {
  ABILITIES,
  ABILITY_LEVEL_MAX,
  ABILITY_QUOTA,
  abilityPointBudget,
  isSheetAbility,
} from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { PanelAvailability } from '../core';

const ON_SHEET_ABILITY_IDS = new Set(
  ABILITIES.filter(isSheetAbility).map((ability) => ability.id),
);

/**
 * One sentence per arm of `AbilityGainState`, supplied by the caller so the six live in the
 * dictionary rather than here.
 *
 * All six are required, and none may be a number on its own. "worth nothing", "cannot be bought",
 * "the model knows no effect" and "the yardstick does not reach this effect" are four different
 * facts about an ability, and a player who cannot tell them apart reads the last three as the
 * first. `notMeasured` in particular must never print a percentage: the effect is real and
 * readable in the ability text, it simply lands outside sustained DPS.
 */
export type AbilityValueCopy = {
  readonly gain: (gainPct: number) => string;
  readonly maxed: string;
  readonly notModelled: string;
  readonly auraAtCeiling: string;
  readonly notMeasured: string;
  readonly unavailable: string;
};

export function abilityValueText(state: AbilityGainState, copy: AbilityValueCopy): string {
  switch (state.kind) {
    case 'gain':
      return copy.gain(state.gainPct);
    case 'maxed':
      return copy.maxed;
    case 'notModelled':
      return copy.notModelled;
    case 'auraAtCeiling':
      return copy.auraAtCeiling;
    case 'notMeasured':
      return copy.notMeasured;
    case 'unavailable':
      return copy.unavailable;
  }
}

export type AbilityRowText = {
  /** The level line. Its prefix is the game's LEVEL abbreviation, never the word this app
   *  reserves for a hero's own letter grade. */
  readonly level: (level: number, max: number) => string;
  readonly value: AbilityValueCopy;
};

export type AbilityRow = {
  readonly abilityId: string;
  readonly level: number;
  readonly max: number;
  readonly levelText: string;
  readonly valueText: string;
  /** The arm the value sentence came from, so the row can be dressed without deciding again. */
  readonly reading: AbilityGainState['kind'];
  readonly onSheet: boolean;
  readonly spent: boolean;
};

/** Every slot the hero owns, unspent level-0 ones included — `abilityGainFor` already returns
 *  them, and a slot a player has yet to touch is the one they most need to see. */
export function abilityRowsFor(
  gains: readonly AbilityGain[],
  text: AbilityRowText,
): readonly AbilityRow[] {
  return gains.map((gain) => ({
    abilityId: gain.abilityId,
    level: gain.level,
    max: gain.max,
    levelText: text.level(gain.level, gain.max),
    valueText: abilityValueText(gain.state, text.value),
    reading: gain.state.kind,
    onSheet: ON_SHEET_ABILITY_IDS.has(gain.abilityId),
    spent: gain.level > 0,
  }));
}

/** A hero with no ability pool gets a stated sentence; an empty grid would read as a failure. */
export function abilityPanelAvailability(gains: readonly AbilityGain[]): PanelAvailability {
  if (gains.length === 0) return { kind: 'unavailable', reason: 'noAbilities' };
  return { kind: 'available' };
}

export type AbilitySlotReadout = {
  readonly used: number;
  readonly quota: number;
  readonly full: boolean;
};

export function abilitySlotReadoutFor(hero: HeroRecord): AbilitySlotReadout {
  const used = heroAbilitySlotsUsed(hero.abilities);
  const quota = ABILITY_QUOTA[hero.rarity];
  return { used, quota, full: used >= quota };
}

/**
 * Three readings, not a count. A hero below its slot ceiling still turns each new level into a
 * spendable point; one sitting exactly on the ceiling has lost nothing yet but gains nothing from
 * the next level either; one past it carries points it can never use. All three report zero or
 * near-zero dead points, and collapsing them would print the same reassuring line for a hero that
 * is fine and one that is about to start wasting every level it earns.
 */
export type DeadPointReading =
  | { readonly kind: 'none'; readonly count: 0 }
  | { readonly kind: 'atCeiling'; readonly count: 0 }
  | { readonly kind: 'dead'; readonly count: number };

export type AbilityPointReadout = {
  /** `ability_points_total === level` — points granted. */
  readonly granted: number;
  readonly spendable: number;
  readonly spent: number;
  readonly dead: DeadPointReading;
};

export function abilityPointReadoutFor(hero: HeroRecord): AbilityPointReadout {
  const granted = hero.level;
  const spendable = abilityPointBudget(hero.rarity, hero.level);
  const spent = Object.values(hero.abilities).reduce((total, level) => total + level, 0);
  const deadCount = granted - spendable;

  return {
    granted,
    spendable,
    spent,
    dead:
      deadCount > 0
        ? { kind: 'dead', count: deadCount }
        : granted === ABILITY_QUOTA[hero.rarity] * ABILITY_LEVEL_MAX
          ? { kind: 'atCeiling', count: 0 }
          : { kind: 'none', count: 0 },
  };
}

export type DeadPointNotes = {
  readonly none: string;
  readonly atCeiling: string;
  readonly dead: (count: number) => string;
};

export function deadPointNote(reading: DeadPointReading, notes: DeadPointNotes): string {
  switch (reading.kind) {
    case 'none':
      return notes.none;
    case 'atCeiling':
      return notes.atCeiling;
    case 'dead':
      return notes.dead(reading.count);
  }
}
