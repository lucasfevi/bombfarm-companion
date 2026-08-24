/**
 * The item-level drop table, pinned.
 *
 * `ITEM_POR_FASE` is emitted from the wiki bundle's `herois.item_por_fase` section, and the
 * scheduled drift check covers it via `data.herois` — so this file is a second guard, not the
 * only one. What drift cannot tell anyone is whether a refresh landed: the 2026-08-15 game update
 * re-cut this table from 9 bands (topping out at item level 90) to 30 (10…300), and the committed
 * bundle went on answering the old one. These assertions are what make a stale or half-applied
 * refresh fail loudly. They cover three separable things:
 *
 * 1. **The live witnesses** — two in-game tooltips captured 2026-08-18 (a capture held out of
 *    band, not in this repo). These are the observations that caught the pre-refresh table
 *    reporting level 20 where the game shows level 30, so they are pinned first and directly.
 * 2. **The closed form** — the published table is `min = 20k − 19`, `max = min(600, 20k + 10)`,
 *    `itemLevel = 10k` for k = 1…30. Asserted row by row, so a future hand-edit that fixes one
 *    band and forgets its neighbour goes red rather than shipping a table with a hole.
 * 3. **The overlap mechanic** — consecutive bands share ten phases, so a phase can legitimately
 *    roll either of two tiers. `itemLevelsForPhase` must return both, sorted and deduped, and
 *    `itemLevelDropLabel` must render the pair as a range.
 *
 * `itemLevelsForPhase` itself is asserted, never edited: the overlap/dedupe/sort/clamp behaviour
 * it already had is correct for the re-cut table, and these tests are what say so.
 */
import { describe, expect, it } from 'vitest';
import {
  ITEM_LEVEL_TIERS,
  ITEM_POR_FASE,
  itemLevelDropLabel,
  itemLevelsForPhase,
} from '@bombfarm/domain/phase-wiki';

const MAX_PHASE = 600;
const BAND_COUNT = 30;

/** The published closed form, written out independently of the bundle it checks. */
function expectedBand(k: number): { min: number; max: number; itemLevel: number } {
  return { min: 20 * k - 19, max: Math.min(MAX_PHASE, 20 * k + 10), itemLevel: 10 * k };
}

describe('item drop level — the live in-game witnesses', () => {
  // Live in-game tooltip capture, 2026-08-18: the stage-info panel on phase 51 reads
  // "Stage item: Level 30". The superseded 9-band table answered [20] here, which is the
  // defect this table replaces.
  it('phase 51 drops level 30', () => {
    expect(itemLevelsForPhase(51)).toEqual([30]);
    expect(itemLevelDropLabel(itemLevelsForPhase(51))).toBe('30');
  });

  // Live in-game tooltip capture, 2026-08-18: phase 60 likewise reads "Stage item: Level 30".
  // Phase 60 is the last phase of that single-tier stretch — 61 opens the next overlap — so the
  // pair 51/60 pins both that the tier is right and that the band does not end early.
  it('phase 60 drops level 30', () => {
    expect(itemLevelsForPhase(60)).toEqual([30]);
    expect(itemLevelDropLabel(itemLevelsForPhase(60))).toBe('30');
  });
});

describe('ITEM_POR_FASE — the committed table matches the published closed form', () => {
  it('has exactly 30 bands, one per item level 10…300', () => {
    expect(ITEM_POR_FASE.length).toBe(BAND_COUNT);
    expect(ITEM_POR_FASE.map((band) => band.itemLevel)).toEqual(
      Array.from({ length: BAND_COUNT }, (_, index) => 10 * (index + 1)),
    );
  });

  it('every row is min = 20k − 19, max = min(600, 20k + 10), itemLevel = 10k', () => {
    let checked = 0;
    for (let k = 1; k <= BAND_COUNT; k++) {
      const band = ITEM_POR_FASE[k - 1];
      expect(band, `band k=${k} should exist`).toBeDefined();
      expect({ min: band.min, max: band.max, itemLevel: band.itemLevel }).toEqual(expectedBand(k));
      checked++;
    }
    expect(checked).toBe(BAND_COUNT);
  });

  it('only the last row is clamped — every other row spans exactly 30 phases', () => {
    for (let k = 1; k < BAND_COUNT; k++) {
      const band = ITEM_POR_FASE[k - 1];
      expect(band.max - band.min + 1, `band k=${k} width`).toBe(30);
    }
    const last = ITEM_POR_FASE[BAND_COUNT - 1];
    expect(last).toEqual({ min: 581, max: MAX_PHASE, itemLevel: 300 });
    expect(20 * BAND_COUNT + 10).toBe(610); // what the form would give without the clamp
  });

  it('bands are in ascending phase order and overlap their successor by exactly 10 phases', () => {
    for (let index = 1; index < ITEM_POR_FASE.length; index++) {
      const previous = ITEM_POR_FASE[index - 1];
      const current = ITEM_POR_FASE[index];
      expect(current.min).toBeGreaterThan(previous.min);
      // `previous.max` is the 10th phase of `current`'s band, on the clamped last row too.
      expect(previous.max - current.min + 1, `bands ${index} → ${index + 1} overlap`).toBe(10);
    }
  });

  it('spans phase 1 to 600 and levels 10 to 300', () => {
    expect(ITEM_POR_FASE[0].min).toBe(1);
    expect(ITEM_POR_FASE[0].itemLevel).toBe(10);
    expect(ITEM_POR_FASE[ITEM_POR_FASE.length - 1].max).toBe(MAX_PHASE);
    expect(ITEM_POR_FASE[ITEM_POR_FASE.length - 1].itemLevel).toBe(300);
  });
});

describe('itemLevelsForPhase — overlap, dedupe, order (asserted, not edited)', () => {
  it('a phase inside a single-tier stretch returns exactly one level', () => {
    expect(itemLevelsForPhase(11)).toEqual([10]); // 1…20 is covered by band 1 alone
    expect(itemLevelsForPhase(35)).toEqual([20]); // 31…40 by band 2 alone
    expect(itemLevelsForPhase(55)).toEqual([30]);
  });

  it('a phase inside an overlap returns both tiers, ascending', () => {
    expect(itemLevelsForPhase(61)).toEqual([30, 40]);
    expect(itemLevelsForPhase(70)).toEqual([30, 40]);
    expect(itemLevelsForPhase(21)).toEqual([10, 20]);
    expect(itemLevelsForPhase(590)).toEqual([290, 300]);
  });

  it('never returns more than two tiers — bands overlap pairwise only', () => {
    for (let phase = 1; phase <= MAX_PHASE; phase++) {
      expect(itemLevelsForPhase(phase).length, `phase ${phase}`).toBeLessThanOrEqual(2);
    }
  });

  it('every phase 1…600 yields a non-empty result — the table has no gaps', () => {
    let checked = 0;
    for (let phase = 1; phase <= MAX_PHASE; phase++) {
      const levels = itemLevelsForPhase(phase);
      expect(levels.length, `phase ${phase} should map to at least one item level`).toBeGreaterThan(0);
      // Sorted ascending and free of duplicates, for every phase.
      expect(levels).toEqual([...new Set(levels)].sort((left, right) => left - right));
      checked++;
    }
    expect(checked).toBe(MAX_PHASE);
  });

  it('item levels never leave the 10…300 ladder the 2026-08-15 patch set', () => {
    for (let phase = 1; phase <= MAX_PHASE; phase++) {
      for (const level of itemLevelsForPhase(phase)) {
        expect(level).toBeGreaterThanOrEqual(10);
        expect(level).toBeLessThanOrEqual(300);
      }
    }
  });

  it('clamps out-of-range phases onto the first and last band instead of returning nothing', () => {
    expect(itemLevelsForPhase(1)).toEqual([10]);
    expect(itemLevelsForPhase(MAX_PHASE)).toEqual([300]);
    expect(itemLevelsForPhase(0)).toEqual(itemLevelsForPhase(1));
    expect(itemLevelsForPhase(-5)).toEqual([10]);
    expect(itemLevelsForPhase(9999)).toEqual(itemLevelsForPhase(MAX_PHASE));
    // Non-integer phases round before the lookup.
    expect(itemLevelsForPhase(60.4)).toEqual([30]);
    expect(itemLevelsForPhase(60.6)).toEqual([30, 40]);
  });
});

describe('itemLevelDropLabel — how the table reaches the UI', () => {
  it('renders a single tier as the bare level', () => {
    expect(itemLevelDropLabel([30])).toBe('30');
    expect(itemLevelDropLabel(itemLevelsForPhase(300))).toBe('150');
  });

  it('renders an overlap as an en-dash range', () => {
    expect(itemLevelDropLabel([30, 40])).toBe('30–40');
    expect(itemLevelDropLabel(itemLevelsForPhase(61))).toBe('30–40');
    expect(itemLevelDropLabel(itemLevelsForPhase(590))).toBe('290–300');
  });

  it('renders empty input as the empty string', () => {
    expect(itemLevelDropLabel([])).toBe('');
  });

  it('is non-empty for every phase 1…600', () => {
    for (let phase = 1; phase <= MAX_PHASE; phase++) {
      expect(itemLevelDropLabel(itemLevelsForPhase(phase)).length, `phase ${phase}`).toBeGreaterThan(0);
    }
  });
});

describe('ITEM_LEVEL_TIERS', () => {
  it('is the closed form ladder — 10…300 in steps of ten, ascending and deduped', () => {
    expect(ITEM_LEVEL_TIERS).toEqual(
      Array.from({ length: BAND_COUNT }, (_unused, index) => expectedBand(index + 1).itemLevel),
    );
  });

  it('every level a phase can drop is offered as a tier', () => {
    for (let phase = 1; phase <= MAX_PHASE; phase++) {
      for (const level of itemLevelsForPhase(phase)) {
        expect(ITEM_LEVEL_TIERS, `phase ${phase}`).toContain(level);
      }
    }
  });
});
