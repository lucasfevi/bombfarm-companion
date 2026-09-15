import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROSTER_CARD_DENSITY,
  ROSTER_CARD_DENSITIES,
  cardSectionsFor,
  isRosterCardDensity,
} from './roster-card-density';

describe('cardSectionsFor', () => {
  it('draws everything at full, which is what the board opens on', () => {
    expect(DEFAULT_ROSTER_CARD_DENSITY).toBe('full');
    expect(cardSectionsFor('full')).toEqual({
      roll: { heading: true, labels: true },
      abilities: { size: 'lg', heading: true, level: true },
      sheetStats: true,
      gear: true,
    });
  });

  it('drops only the gear at combat, so the card is the hero as a fighter', () => {
    expect(cardSectionsFor('combat')).toEqual({
      roll: { heading: true, labels: true },
      abilities: { size: 'lg', heading: true, level: true },
      sheetStats: true,
      gear: false,
    });
  });

  it('keeps the abilities small, badgeless and unheaded on one row at compact, and drops the rest', () => {
    expect(cardSectionsFor('compact')).toEqual({
      roll: { heading: false, labels: false },
      abilities: { size: 'xs', heading: false, level: false },
      sheetStats: false,
      gear: false,
    });
  });

  it('never drops the roll bars or the ability pool: no preset hides what a hero is', () => {
    // The discriminating case: `roll` has no field that could hide the bars and `abilities` is
    // never off, so a preset cannot turn either away — what is not in the model a card always
    // draws.
    for (const density of ROSTER_CARD_DENSITIES) {
      const sections = cardSectionsFor(density);
      expect(Object.keys(sections).sort()).toEqual(['abilities', 'gear', 'roll', 'sheetStats']);
      expect(Object.keys(sections.roll).sort()).toEqual(['heading', 'labels']);
      expect(['xs', 'lg']).toContain(sections.abilities.size);
    }
  });

  it('leaves the sheet stats off the compact card alone', () => {
    expect(ROSTER_CARD_DENSITIES.filter((d) => !cardSectionsFor(d).sheetStats)).toEqual([
      'compact',
    ]);
  });

  it('drops the ability level badge only where the icon shrinks to have no room for it', () => {
    for (const density of ROSTER_CARD_DENSITIES) {
      const { size, level } = cardSectionsFor(density).abilities;
      expect(level).toBe(size === 'lg');
    }
  });

  it('heads the roll bars wherever their codes are drawn, and nowhere else', () => {
    // Compact drops both for the same reason — height — so a heading over unlabelled bars would
    // be a preset that exists in no reading.
    for (const density of ROSTER_CARD_DENSITIES) {
      const { heading, labels } = cardSectionsFor(density).roll;
      expect(heading).toBe(labels);
    }
  });
});

describe('ROSTER_CARD_DENSITIES', () => {
  it('names the three presets in the order the toggle offers them, least to most', () => {
    expect(ROSTER_CARD_DENSITIES).toEqual(['compact', 'combat', 'full']);
  });

  it('recognises exactly its own names, which is what a toggle handing back a string needs', () => {
    for (const density of ROSTER_CARD_DENSITIES) expect(isRosterCardDensity(density)).toBe(true);
    expect(isRosterCardDensity('cards')).toBe(false);
    expect(isRosterCardDensity('')).toBe(false);
  });
});
