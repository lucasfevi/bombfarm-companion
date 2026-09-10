import { describe, expect, it } from 'vitest';
import type { SheetStats } from '@bombfarm/domain/gear';
import type { StatRanges } from '@bombfarm/domain/birth-sheet';
import { SHEET_PANEL_KEYS, ZERO_PTS_TEMPLATE } from '@bombfarm/domain/planner-constants';
import { LETTER_BANDS, boundaryCutPoint, rollQualityFor } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  birthRollAvailability,
  gradePlacementFor,
  gradeRailFor,
  heroPowerTextFor,
  marketTileReadingFor,
  marketValueReadingFor,
  marketableReadingFor,
  letterDisagreementFor,
  nextLetterReadout,
  rollValueIsPercent,
  statRollRowsFor,
} from './birth-roll-panel';

/**
 * Every hero below rolls each of its eight statistics inside a 0–100 window, so a statistic's
 * percentile IS its rolled value and the report's mean is that value exactly. The letters those
 * means fall in are then read off `LETTER_BANDS` itself rather than restated here, so a future
 * re-measurement of the corpus moves these tests with it instead of falsifying them.
 */
const FULL_BAND: StatRanges = Object.fromEntries(
  SHEET_PANEL_KEYS.map((key) => [key, { min: 0, max: 100 }]),
);

function birthAt(percentile: number): SheetStats {
  return {
    ...ZERO_PTS_TEMPLATE,
    ...Object.fromEntries(SHEET_PANEL_KEYS.map((key) => [key, percentile])),
  };
}

function hero(fields: Partial<HeroRecord>): HeroRecord {
  return {
    id: 'hero-1',
    name: 'Hero',
    updatedAt: 0,
    rarity: 'Comum',
    level: 60,
    stars: 0,
    naked: { ...ZERO_PTS_TEMPLATE },
    loadout: {},
    altLoadout: null,
    gearedOverride: { ...ZERO_PTS_TEMPLATE },
    abilities: {},
    pts: { ...ZERO_PTS_TEMPLATE },
    ...fields,
  };
}

/** A hero whose eight rolls all land on `percentile`, giving a report with that exact mean. */
function rolledAt(percentile: number, rank?: string): HeroRecord {
  return hero({ birth: birthAt(percentile), statRanges: FULL_BAND, ...(rank ? { rank } : {}) });
}

function reportFor(record: HeroRecord) {
  const report = rollQualityFor(record);
  if (report === undefined) throw new Error('fixture was expected to produce a report');
  return report;
}

const cutPoints = LETTER_BANDS.boundaries.map(boundaryCutPoint);

/** A mean comfortably inside the letter at `index`, away from either bracketed edge. */
function insideLetter(index: number): number {
  const low = index === 0 ? LETTER_BANDS.evidence[0].observedMin : LETTER_BANDS.boundaries[index - 1].max;
  const high =
    index === cutPoints.length
      ? LETTER_BANDS.evidence[LETTER_BANDS.evidence.length - 1].observedMax
      : LETTER_BANDS.boundaries[index].min;
  return (low + high) / 2;
}

const TOP_LETTER_INDEX = LETTER_BANDS.letters.length - 1;
const A_INDEX = TOP_LETTER_INDEX - 1;

const oneDecimal = (value: number) => value.toFixed(1);

describe('birthRollAvailability', () => {
  it('a hero with a full report is available', () => {
    const record = rolledAt(insideLetter(A_INDEX), LETTER_BANDS.letters[A_INDEX]);

    expect(birthRollAvailability(record, reportFor(record))).toEqual({ kind: 'available' });
  });

  it('a hero with no birth roll is unavailable for that reason, carrying no percentile', () => {
    const record = hero({ statRanges: FULL_BAND });

    expect(rollQualityFor(record)).toBeUndefined();
    // toEqual on the whole result, not a property probe: it also proves no number rode along.
    expect(birthRollAvailability(record, rollQualityFor(record))).toEqual({
      kind: 'unavailable',
      reason: 'noBirthRoll',
    });
    expect(gradePlacementFor(rollQualityFor(record))).toBeUndefined();

    const rows = statRollRowsFor(record, oneDecimal, oneDecimal);
    expect(rows.map((row) => row.percentile)).toEqual(SHEET_PANEL_KEYS.map(() => undefined));
    expect(rows.flatMap((row) => [row.value, row.band, row.position]).join(' ')).not.toMatch(/\d/);
  });

  it('a hero with no roll bounds is unavailable for a different reason', () => {
    const withRolls = hero({ birth: birthAt(50) });
    const withoutRolls = hero({ statRanges: FULL_BAND });

    expect(birthRollAvailability(withRolls, rollQualityFor(withRolls))).toEqual({
      kind: 'unavailable',
      reason: 'noRollBounds',
    });
    expect(birthRollAvailability(withRolls, rollQualityFor(withRolls))).not.toEqual(
      birthRollAvailability(withoutRolls, rollQualityFor(withoutRolls)),
    );
  });
});

describe('gradePlacementFor and letterDisagreementFor', () => {
  it('a computed/stored letter disagreement is reported with the stored letter still present', () => {
    const record = rolledAt(insideLetter(A_INDEX), LETTER_BANDS.letters[0]);
    const report = reportFor(record);

    expect(report.computedLetter).toBe(LETTER_BANDS.letters[A_INDEX]);
    expect(letterDisagreementFor(report)).toEqual({
      storedLetter: LETTER_BANDS.letters[0],
      computedLetter: LETTER_BANDS.letters[A_INDEX],
    });
    const placement = gradePlacementFor(report);
    expect(placement?.storedLetter).toBe(LETTER_BANDS.letters[0]);
    expect(placement?.certainty).toEqual({ kind: 'uncertain', cause: 'letterDisagreement' });
  });

  it('an unknown stored letter is uncertain but is not a disagreement', () => {
    const record = rolledAt(insideLetter(A_INDEX), 'Z');
    const report = reportFor(record);

    expect(letterDisagreementFor(report)).toBeUndefined();
    const placement = gradePlacementFor(report);
    expect(placement?.certainty).toEqual({ kind: 'uncertain', cause: 'unknownStoredLetter' });
    // The rail cannot be read against a letter this table does not know, so it falls to ours.
    expect(placement?.railLetter).toBe(LETTER_BANDS.letters[A_INDEX]);
  });

  it('sitting near a bracketed edge is neither of the two uncertain causes', () => {
    const boundary = LETTER_BANDS.boundaries[A_INDEX - 1];
    const mean = (boundary.min + boundary.max) / 2;
    const record = rolledAt(mean, mean < boundaryCutPoint(boundary) ? boundary.below : boundary.above);
    const report = reportFor(record);

    expect(report.nearBoundary).toBe(true);
    expect(letterDisagreementFor(report)).toBeUndefined();
    expect(gradePlacementFor(report)?.certainty).toEqual({ kind: 'nearBoundary' });
  });

  it('a settled placement reads against the letter the game stored', () => {
    const stored = LETTER_BANDS.letters[A_INDEX];
    const placement = gradePlacementFor(reportFor(rolledAt(insideLetter(A_INDEX), stored)));

    expect(placement?.certainty).toEqual({ kind: 'settled' });
    expect(placement?.railLetter).toBe(stored);
  });
});

describe('nextLetterReadout', () => {
  it('renders the distance as a range with two distinct ends', () => {
    const record = rolledAt(insideLetter(A_INDEX), LETTER_BANDS.letters[A_INDEX]);
    const readout = nextLetterReadout(reportFor(record), oneDecimal);

    expect(readout?.letter).toBe(LETTER_BANDS.letters[TOP_LETTER_INDEX]);
    const ends = readout?.range.split('–') ?? [];
    expect(ends).toHaveLength(2);
    expect(ends[0]).not.toBe(ends[1]);
    expect(Number(ends[0])).toBeLessThan(Number(ends[1]));
  });

  it('the top grade has no next letter and none is invented', () => {
    const top = LETTER_BANDS.letters[TOP_LETTER_INDEX];
    const report = reportFor(rolledAt(insideLetter(TOP_LETTER_INDEX), top));

    expect(report.computedLetter).toBe(top);
    expect(report.toNextLetter).toBeUndefined();
    expect(nextLetterReadout(report, oneDecimal)).toBeUndefined();
  });
});

describe('gradeRailFor', () => {
  it('letter widths follow the measured cut points rather than even spacing', () => {
    const rail = gradeRailFor(insideLetter(A_INDEX));
    const widths = rail.segments.map((segment) => segment.endPct - segment.startPct);

    expect(rail.segments.map((segment) => segment.letter)).toEqual([...LETTER_BANDS.letters]);
    expect(rail.segments[0].startPct).toBe(0);
    expect(rail.segments[rail.segments.length - 1].endPct).toBe(100);
    // Even spacing would make all six equal; the corpus makes E by far the widest.
    expect(Math.max(...widths)).toBe(widths[0]);
    expect(new Set(widths.map((width) => width.toFixed(4))).size).toBeGreaterThan(1);
  });

  it('each boundary occupies width, because the evidence brackets it rather than locating it', () => {
    const rail = gradeRailFor(insideLetter(A_INDEX));

    expect(rail.boundaries).toHaveLength(LETTER_BANDS.boundaries.length);
    for (const boundary of rail.boundaries) {
      expect(boundary.endPct).toBeGreaterThan(boundary.startPct);
    }
  });

  it('a hero outside every observed extreme stretches the domain instead of being clamped', () => {
    const beyond = LETTER_BANDS.evidence[LETTER_BANDS.evidence.length - 1].observedMax + 5;
    const rail = gradeRailFor(beyond);

    expect(rail.domainMax).toBe(beyond);
    expect(rail.markerPct).toBe(100);
  });
});

describe('statRollRowsFor', () => {
  it('places every statistic and marks a roll outside its own window', () => {
    const record = hero({
      birth: birthAt(40),
      statRanges: { ...FULL_BAND, attack: { min: 0, max: 10 } },
    });
    const rows = statRollRowsFor(record, oneDecimal, oneDecimal);
    const attack = rows.find((row) => row.key === 'attack');

    expect(rows).toHaveLength(SHEET_PANEL_KEYS.length);
    expect(attack?.outOfBand).toBe(true);
    expect(attack?.band).toBe('0.0 – 10.0');
    expect(rows.find((row) => row.key === 'energy')?.percentile).toBe(40);
  });

  it('prints a percentage sign on the rate statistics and on none of the counts', () => {
    const rows = statRollRowsFor(hero({ birth: birthAt(40), statRanges: FULL_BAND }), oneDecimal, oneDecimal);
    const rowFor = (key: (typeof SHEET_PANEL_KEYS)[number]) => rows.find((row) => row.key === key);

    for (const key of SHEET_PANEL_KEYS.filter(rollValueIsPercent)) {
      expect(rowFor(key)?.value, `${key} rolled value`).toMatch(/%$/);
      expect(rowFor(key)?.band, `${key} band`).toMatch(/%$/);
    }
    for (const key of SHEET_PANEL_KEYS.filter((key) => !rollValueIsPercent(key))) {
      expect(rowFor(key)?.value, `${key} rolled value`).not.toContain('%');
      expect(rowFor(key)?.band, `${key} band`).not.toContain('%');
    }
  });

  it('non-vacuity: both populations exist, so neither loop above passes by being empty', () => {
    const rates = SHEET_PANEL_KEYS.filter(rollValueIsPercent);
    const counts = SHEET_PANEL_KEYS.filter((key) => !rollValueIsPercent(key));

    expect(rates.length).toBeGreaterThan(0);
    expect(counts.length).toBeGreaterThan(0);
    // Attack is the one every reader recognises as a count, and crit chance as a rate.
    expect(counts).toContain('attack');
    expect(rates).toContain('critChance');
  });

  it('marks the band once rather than at both ends, so a range reads as one quantity', () => {
    const rows = statRollRowsFor(hero({ birth: birthAt(40), statRanges: FULL_BAND }), oneDecimal, oneDecimal);

    expect(rows.find((row) => row.key === 'critChance')?.band).toBe('0.0 – 100.0%');
  });

  it('leaves an unplaceable statistic as the stated absence, with no stray unit', () => {
    const rows = statRollRowsFor(hero({}), oneDecimal, oneDecimal);

    for (const row of rows) {
      expect(row.value).not.toContain('%');
      expect(row.band).not.toContain('%');
    }
  });
});

describe('marketableReadingFor', () => {
  it('keeps not-asked apart from not-sellable, rather than reading absence as no', () => {
    expect(marketableReadingFor(hero({}))).toBe('unknown');
    expect(marketableReadingFor(hero({ marketable: false }))).toBe('no');
    expect(marketableReadingFor(hero({ marketable: true }))).toBe('yes');
  });
});

describe('heroPowerTextFor', () => {
  const groupThousands = (value: number) => value.toLocaleString('en-US');

  it('prints the figure the save recorded', () => {
    expect(heroPowerTextFor(hero({ power: 12345 }), groupThousands)).toBe('12,345');
  });

  it('prints an em dash for a hero nobody imported a power for, never a zero', () => {
    expect(heroPowerTextFor(hero({}), groupThousands)).toBe('—');
  });

  it('prints a recorded zero as a zero — the figure is known, and it is nought', () => {
    expect(heroPowerTextFor(hero({ power: 0 }), groupThousands)).toBe('0');
  });
});

describe('the fixture bands really are the ones the assertions assume', () => {
  it('a rolled value equals its percentile, so a mean is the value all eight rolled at', () => {
    const mean = insideLetter(A_INDEX);
    const record = rolledAt(mean, LETTER_BANDS.letters[A_INDEX]);

    expect(reportFor(record).mean).toBeCloseTo(mean, 10);
    expect(reportFor(record).contributingStats).toBe(SHEET_PANEL_KEYS.length);
  });
});

describe('marketValueReadingFor', () => {
  const LISTING = 'https://steamcommunity.com/market/listings/1/Rare%20Hero';
  const priced = { amount: 1.23, currency: 'USD', listingUrl: LISTING };

  it('prints the figure for a hero the game will let go', () => {
    expect(marketValueReadingFor('yes', priced)).toEqual({
      kind: 'value',
      amount: 1.23,
      currency: 'USD',
      listingUrl: LISTING,
    });
  });

  it('carries the page the figure came from, so the reader can go and check it', () => {
    const reading = marketValueReadingFor('yes', priced);
    expect(reading.kind === 'value' && reading.listingUrl).toBe(LISTING);
  });

  it('resolves an unquoted listing to null rather than leaving the field absent', () => {
    expect(marketValueReadingFor('yes', { amount: 1.23, currency: 'USD' })).toEqual({
      kind: 'value',
      amount: 1.23,
      currency: 'USD',
      listingUrl: null,
    });
  });

  it('quotes nothing for an account-bound hero, which a rarity lookup would still price', () => {
    // The discriminating case: the price is present and valid, and must still not be shown.
    expect(marketValueReadingFor('no', priced)).toEqual({ kind: 'hidden' });
  });

  it('quotes nothing while tradability is unknown, rather than assuming it is sellable', () => {
    expect(marketValueReadingFor('unknown', priced)).toEqual({ kind: 'hidden' });
  });

  it('hides the row when nothing was quoted, rather than printing an empty value', () => {
    expect(marketValueReadingFor('yes', null)).toEqual({ kind: 'hidden' });
    expect(marketValueReadingFor('yes', undefined)).toEqual({ kind: 'hidden' });
    expect(marketValueReadingFor('yes', { amount: null, currency: 'USD' })).toEqual({ kind: 'hidden' });
  });

  it('keeps a genuine zero, which is a quote and not an absence', () => {
    expect(marketValueReadingFor('yes', { amount: 0, currency: 'BRL' })).toEqual({
      kind: 'value',
      amount: 0,
      currency: 'BRL',
      listingUrl: null,
    });
  });
});

describe('marketTileReadingFor', () => {
  const LISTING = 'https://steamcommunity.com/market/listings/1/Rare%20Hero';
  const priced = { amount: 1.23, currency: 'BRL', listingUrl: LISTING };

  it('prints the quote when there is one', () => {
    expect(marketTileReadingFor('yes', priced)).toEqual({
      kind: 'value',
      amount: 1.23,
      currency: 'BRL',
      listingUrl: LISTING,
    });
  });

  it('hands over the listing, which is what makes the tile a link', () => {
    const reading = marketTileReadingFor('yes', priced);
    expect(reading.kind === 'value' && reading.listingUrl).toBe(LISTING);
  });

  it('quotes with no link when the host resolved no listing', () => {
    expect(marketTileReadingFor('yes', { amount: 1.23, currency: 'BRL' })).toEqual({
      kind: 'value',
      amount: 1.23,
      currency: 'BRL',
      listingUrl: null,
    });
  });

  it('says not sellable for an account-bound hero, even with a price in hand', () => {
    // The discriminating case: a rarity lookup would price it, and it must still not be quoted.
    expect(marketTileReadingFor('no', priced)).toEqual({ kind: 'notSellable' });
  });

  it('says not sellable when the hero could be sold but nothing is quoted', () => {
    // A figure is the only thing a player can act on, so "sellable, amount unknown" is not an
    // answer this tile gives — it would read as a price of nothing.
    expect(marketTileReadingFor('yes', null)).toEqual({ kind: 'notSellable' });
    expect(marketTileReadingFor('yes', { amount: null, currency: 'BRL' })).toEqual({ kind: 'notSellable' });
  });

  it('says not sellable while tradability is unknown, rather than guessing either way', () => {
    expect(marketTileReadingFor('unknown', priced)).toEqual({ kind: 'notSellable' });
  });

  it('keeps a genuine zero, which is a quote and not an absence', () => {
    expect(marketTileReadingFor('yes', { amount: 0, currency: 'BRL' })).toEqual({
      kind: 'value',
      amount: 0,
      currency: 'BRL',
      listingUrl: null,
    });
  });
});
