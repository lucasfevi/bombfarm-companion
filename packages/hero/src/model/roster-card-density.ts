/**
 * How much of a hero each card on the roster board draws.
 *
 * Three presets rather than a set of switches, because the question a reader brings to the board
 * changes what a card is for. Compact is the whole roster on one screen — identity, power, the
 * roll bars in a single line and the ability pool as a row of small icons, because the pool is
 * part of what a hero IS; nothing carries a heading, since height is the point. Combat is the
 * hero as a fighter: the sheet stats the game scores damage on and the abilities at full size.
 * Full is the card entire, gear included — the one part of a card that is about what the hero is
 * wearing rather than what it is.
 *
 * The board's own setting, not the toolbar's: the toolbar governs both presentations and the list
 * has no density, so a control there would be a rule the list could not honour.
 */
export const ROSTER_CARD_DENSITIES = ['compact', 'combat', 'full'] as const;

export type RosterCardDensity = (typeof ROSTER_CARD_DENSITIES)[number];

export const DEFAULT_ROSTER_CARD_DENSITY: RosterCardDensity = 'full';

export type RosterCardRoll = {
  readonly heading: boolean;
  /** The codes under the bars; hidden when the bars are drawn in one row. */
  readonly labels: boolean;
};

export type RosterCardAbilities = {
  /** `xs` is six on one row; `lg` is the three-per-row grid. */
  readonly size: 'xs' | 'lg';
  readonly heading: boolean;
  /** The level badge on each icon, which a 28px icon has no room for. */
  readonly level: boolean;
};

export type RosterCardSections = {
  readonly roll: RosterCardRoll;
  /** Every preset draws the pool; what differs is how large, whether headed, and the badge. */
  readonly abilities: RosterCardAbilities;
  /** The eight sheet stats as figures — the roll bars say where they landed, this says what. */
  readonly sheetStats: boolean;
  readonly gear: boolean;
};

export function isRosterCardDensity(value: string): value is RosterCardDensity {
  return (ROSTER_CARD_DENSITIES as readonly string[]).includes(value);
}

export function cardSectionsFor(density: RosterCardDensity): RosterCardSections {
  switch (density) {
    case 'compact':
      return {
        roll: { heading: false, labels: false },
        abilities: { size: 'xs', heading: false, level: false },
        sheetStats: false,
        gear: false,
      };
    case 'combat':
      return {
        roll: { heading: true, labels: true },
        abilities: { size: 'lg', heading: true, level: true },
        sheetStats: true,
        gear: false,
      };
    case 'full':
      return {
        roll: { heading: true, labels: true },
        abilities: { size: 'lg', heading: true, level: true },
        sheetStats: true,
        gear: true,
      };
  }
}
