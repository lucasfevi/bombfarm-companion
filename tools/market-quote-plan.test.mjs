/**
 * How a pass decides what to spend its calls on.
 *
 * Two of these hold claims that a narrower test would pass on by accident. Membership is asserted
 * in both directions from the readings alone, because a test that only proves an item is in the
 * rotation would pass just as well against a hardcoded list. And the budget is asserted by
 * counting a simulated day's calls the way the address counts them — every call, whatever
 * endpoint it went to — because the defect being fixed is a rotation paced correctly inside a day
 * that spent about 9% more than it was configured to.
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_SPACING_MS,
  planPacing,
  planPass,
  readBudget,
  splitRotation,
  tiersAfterPass,
  tiersFromHistory,
} from './market-snapshot/quote-plan.mjs';

const DAY_MS = 86_400_000;
const SEARCH_DELAY_MS = 1_500;

/** The floor the collector holds a pass to, so a fast pass does not republish inside the CDN's. */
const MIN_PASS_MS = 300_000;

const reading = (hashName, volume) => ({ hash_name: hashName, volume });

const quotedAt = (entries) =>
  new Map(entries.map(([hashName, volume]) => [hashName, { BRL: { lowest: 1, median: 1, volume } }]));

/**
 * What a day of passes at this spacing actually costs. Deliberately re-derived here rather than
 * read off the plan: the plan's only output is a delay, and this is the arithmetic that says
 * whether that delay keeps the day inside the number the address is counting against.
 */
function callsInADay({ spacingMs, quoteCalls, enumerationCalls }) {
  const passMs = Math.max(
    MIN_PASS_MS,
    enumerationCalls * SEARCH_DELAY_MS + quoteCalls * spacingMs,
  );
  return (DAY_MS / passMs) * (enumerationCalls + quoteCalls);
}

const pacingFor = (budget, quoteCalls, enumerationCalls) =>
  planPacing({ budget, quoteCount: quoteCalls, enumerationCalls, searchDelayMs: SEARCH_DELAY_MS });

describe('the budget is a total-call budget', () => {
  it.each([
    [600, 53, 10],
    [600, 109, 10],
    [2000, 109, 10],
    [2000, 53, 31],
    [700, 12, 4],
    [5000, 240, 34],
  ])(
    'spends at most %i calls a day quoting %i items behind %i enumeration calls',
    (budget, quoteCalls, enumerationCalls) => {
      const { spacingMs } = pacingFor(budget, quoteCalls, enumerationCalls);
      expect(callsInADay({ spacingMs, quoteCalls, enumerationCalls })).toBeLessThanOrEqual(budget);
    },
  );

  it('spends the budget rather than a fraction of it, so freshness is not left on the table', () => {
    const { spacingMs } = pacingFor(600, 53, 10);
    expect(callsInADay({ spacingMs, quoteCalls: 53, enumerationCalls: 10 })).toBeGreaterThan(599);
  });

  /**
   * The defect. Pacing the rotation alone leaves the enumeration outside the number configured,
   * and the quota makes no such distinction — so a budget of 2,000 bought about 2,175 calls.
   */
  it('overshoots when the enumeration is left outside it', () => {
    const rotationOnly = Math.floor(DAY_MS / 2000);
    const spent = callsInADay({
      spacingMs: rotationOnly,
      quoteCalls: 109,
      enumerationCalls: 10,
    });

    expect(spent).toBeGreaterThan(2000);
    expect(pacingFor(2000, 109, 10).spacingMs).toBeGreaterThan(rotationOnly);
  });

  it('counts one call per item per currency, not one per item', () => {
    const planFor = (currencyCount) =>
      planPass({
        hashNames: ['A', 'B'],
        tiers: tiersFromHistory([reading('A', 4), reading('B', 4)]),
        budget: 600,
        currencyCount,
        enumerationCalls: 10,
        searchDelayMs: SEARCH_DELAY_MS,
      });

    expect(planFor(1).hashNames).toEqual(['A', 'B']);
    expect(planFor(1).callsPerPass).toBe(12);
    expect(planFor(2).hashNames).toEqual(['A', 'B']);
    expect(planFor(2).callsPerPass).toBe(14);
  });

  it('raises the cadence when the budget rises, with no other change', () => {
    expect(pacingFor(4000, 109, 10).spacingMs).toBeLessThan(pacingFor(2000, 109, 10).spacingMs);
  });

  it('clamps a budget that would breach the measured-safe floor, and says it clamped', () => {
    const pacing = pacingFor(1_000_000, 109, 10);
    expect(pacing.spacingMs).toBe(MIN_SPACING_MS);
    expect(pacing.spacingClamped).toBe(true);
  });

  it.each([0, -1, 'abc', ''])('refuses the budget %p, naming the variable and the value', (bad) => {
    expect(() => readBudget(bad)).toThrow(/MARKET_DAILY_BUDGET/);
    expect(() => readBudget(bad)).toThrow(JSON.stringify(bad));
  });
});

describe('membership follows the readings, in both directions', () => {
  it('drops an item out of the rotation once the window holds no sale for it', () => {
    const whileTrading = tiersFromHistory([reading('Traded', 12), reading('Quiet', 0)]);
    expect(splitRotation(['Traded', 'Quiet'], whileTrading).quote).toEqual(['Traded']);

    const afterItStopped = tiersFromHistory([reading('Traded', 0), reading('Quiet', 0)]);
    const split = splitRotation(['Traded', 'Quiet'], afterItStopped);
    expect(split.quote).toEqual([]);
    expect(split.enumerationOnly).toEqual(['Traded', 'Quiet']);
  });

  it('puts an item into the rotation once the window holds a sale for it', () => {
    const beforeItTraded = tiersFromHistory([reading('Quiet', 0), reading('Waking', 0)]);
    expect(splitRotation(['Quiet', 'Waking'], beforeItTraded).quote).toEqual([]);

    const afterItTraded = tiersFromHistory([reading('Quiet', 0), reading('Waking', 3)]);
    expect(splitRotation(['Quiet', 'Waking'], afterItTraded).quote).toEqual(['Waking']);
  });

  it('reads one sale anywhere in the window as trading, not only the latest reading', () => {
    const tiers = tiersFromHistory([reading('A', 0), reading('A', 9), reading('A', 0)]);
    expect(splitRotation(['A'], tiers).quote).toEqual(['A']);
  });

  it('ignores a reading the store answered without a volume', () => {
    const tiers = tiersFromHistory([reading('A', null), reading('A', undefined)]);
    const split = splitRotation(['A'], tiers);
    expect(split.quote).toEqual([]);
    expect(split.enumerationOnly).toEqual(['A']);
  });
});

describe('an item with no trading history is quoted once and placed by the result', () => {
  const known = tiersFromHistory([reading('Known', 0)]);

  it('quotes it rather than assuming either side', () => {
    const split = splitRotation(['Known', 'New'], known);
    expect(split.quote).toEqual(['New']);
    expect(split.firstQuote).toEqual(['New']);
  });

  it('keeps it once that quote reports a sale', () => {
    const after = tiersAfterPass(known, {
      attempted: ['New'],
      quotes: quotedAt([['New', 7]]),
    });
    expect(splitRotation(['Known', 'New'], after).quote).toEqual(['New']);
  });

  it('retires it once that quote reports none', () => {
    const after = tiersAfterPass(known, {
      attempted: ['New'],
      quotes: quotedAt([['New', 0]]),
    });
    const split = splitRotation(['Known', 'New'], after);
    expect(split.quote).toEqual([]);
    expect(split.enumerationOnly).toEqual(['Known', 'New']);
  });

  /**
   * The quote endpoint under-reports: it answers some live listings with no price at all. Reading
   * that silence as "still no history" would put the item back in the rotation every pass forever,
   * which is the strand this is meant to avoid.
   */
  it('retires it once the market answered the quote with nothing', () => {
    const after = tiersAfterPass(known, { attempted: ['New'], quotes: new Map() });
    expect(splitRotation(['Known', 'New'], after).quote).toEqual([]);
  });

  it('leaves an item the pass never reached exactly where it was', () => {
    const after = tiersAfterPass(known, { attempted: [], quotes: new Map() });
    expect(splitRotation(['Known', 'New'], after).quote).toEqual(['New']);
  });
});

/**
 * One pass reads one 24-hour figure. An item that traded last week and not in the hour this pass
 * happened to ask is still an item that trades, so only the recompute over the whole window may
 * take it out.
 */
describe('a single pass promotes but never demotes', () => {
  it('keeps an item the window says trades, through a pass that saw no sale', () => {
    const tiers = tiersFromHistory([reading('Traded', 12)]);
    const after = tiersAfterPass(tiers, {
      attempted: ['Traded'],
      quotes: quotedAt([['Traded', 0]]),
    });
    expect(splitRotation(['Traded'], after).quote).toEqual(['Traded']);
  });
});
