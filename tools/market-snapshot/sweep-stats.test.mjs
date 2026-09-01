/**
 * The seam no type reaches: that the sweep's statistics describe the pass that actually happened.
 *
 * The rate-limit count is read off log prose — the one line the rotation emits per 429 and the one
 * the discovery pass emits — because neither pass totals them. Reword either message and the count
 * silently goes to zero while every other suite stays green. So this drives `runSweep` against a
 * stubbed network, with no request made, down each path in turn. That is what this file is for,
 * and it is what makes the counter safe to depend on.
 */
import { describe, expect, it, vi } from 'vitest';
import { assertWorkspaceDistBuilt } from '../require-workspace-dist.mjs';

// Per-file build guard, on this file's OWN key: the builder resolves @bombfarm/pricing through
// that package's exports map, which points at ./dist/**. The import below is dynamic so this
// assert runs first and names the unbuilt package, instead of the import dying at collection with
// an error that points nowhere near `pnpm build`.
assertWorkspaceDistBuilt('tools/market-snapshot/sweep-stats.test.mjs');

const { runSweep, summarise } = await import('./build.mjs');

const CATALOG = {
  defs: [{ defId: 'coal_bota', set: 'coal', slot: 'bota', level: 30 }],
  rarityIdxs: [2],
  rarityTokens: { 2: 'raro' },
  defIdByHash: {},
  sets: ['coal'],
  slots: ['bota'],
};

const ROWS = [
  ['Coal Boots Lv 30 (Rare)', 480],
  ['Topaz Gem', 250],
].map(([hashName, sellPriceCents]) => ({
  hashName,
  name: hashName,
  sellPriceCents,
  listings: 2,
  iconUrl: null,
  type: null,
}));

/** Steam publishing a slot nothing maps: an anomaly of a kind the unlinkable count must exclude. */
const APP_FILTERS = { success: true, facets: { s: { name: 'slot', tags: { notaslot: {} } } } };

const isFlatQuery = (url) =>
  ![...new URL(url).searchParams.keys()].some((key) => key.startsWith('category_'));

/** Enough consecutive rate limits to trip either pass's circuit breaker. */
const PAST_THE_BREAKER = 99;

function sweepWith({ searchRateLimits = 0, quoteRateLimits = 0, currencies = ['BRL'] } = {}) {
  let searchLeft = searchRateLimits;
  let quoteLeft = quoteRateLimits;
  const lines = [];

  const steamNet = {
    fetchAppFilters: () => Promise.resolve(APP_FILTERS),
    fetchSearchPage: (url) => {
      if (searchLeft > 0) {
        searchLeft -= 1;
        return Promise.resolve({ ok: false, rateLimited: true });
      }
      const rows = isFlatQuery(url) ? ROWS : [];
      return Promise.resolve({ ok: true, page: { totalCount: rows.length, rows } });
    },
    fetchPriceOverview: () => {
      if (quoteLeft > 0) {
        quoteLeft -= 1;
        return Promise.resolve({ ok: false, rateLimited: true });
      }
      return Promise.resolve({ ok: true, quote: { lowest: 25, median: 26.5, volume: 1234 } });
    },
    fetchFx: () => Promise.resolve({ ok: true, rates: { USD: 1, BRL: 5.4 } }),
  };

  return runSweep({
    catalog: CATALOG,
    searchDelayMs: 0,
    quoteDelayMs: 0,
    nativeCurrencies: currencies,
    log: (message) => lines.push(message),
    now: () => Date.parse('2026-09-01T00:00:00.000Z'),
    steamNet,
  }).then(({ snapshot, stats }) => ({ snapshot, stats, lines }));
}

describe('the sweep counts the rate limits its two passes log', () => {
  it('reads zero from a pass that hit none, so the counts below are not counting noise', async () => {
    const { stats } = await sweepWith();
    expect(stats.rateLimitHits).toBe(0);
  });

  it('counts what the rotation logs — reword that message and this goes red', async () => {
    const { stats } = await sweepWith({ quoteRateLimits: 2 });
    expect(stats.rateLimitHits).toBe(2);
  });

  it('counts what the discovery pass logs — reword that message and this goes red', async () => {
    const { stats } = await sweepWith({ searchRateLimits: 2 });
    expect(stats.rateLimitHits).toBe(2);
  });

  it('keeps the counted reading when the derivation cannot see the pass that was limited', async () => {
    const { stats } = await sweepWith({ searchRateLimits: 2 });
    expect(stats.rateLimitHitsDerived).toBe(0);
    expect(stats.rateLimitHits).toBe(2);
  });
});

describe('the arithmetic cross-check', () => {
  it('agrees with the count on a pass the rotation finished', async () => {
    const { stats } = await sweepWith({ quoteRateLimits: 2 });
    expect(stats.quotesComplete).toBe(true);
    expect(stats.rateLimitHitsDerived).toBe(stats.rateLimitHits);
    expect(stats.rateLimitHitsDerived).toBe(2);
  });

  it('is absent once the breaker trips, because the items after it were never attempted', async () => {
    const { stats } = await sweepWith({ quoteRateLimits: PAST_THE_BREAKER });
    expect(stats.quotesComplete).toBe(false);
    expect(stats.rateLimitHitsDerived).toBeNull();
    expect(stats.rateLimitHits).toBeGreaterThan(0);
  });
});

describe('the sweep reports what it asked for and what it could not explain', () => {
  it('attempts one quote per quotable row per currency', async () => {
    const one = await sweepWith({ currencies: ['BRL'] });
    const two = await sweepWith({ currencies: ['BRL', 'USD'] });

    expect(one.stats.quotesAttempted).toBe(ROWS.length);
    expect(two.stats.quotesAttempted).toBe(ROWS.length * 2);
  });

  it('counts exactly the priced rows nothing owned can look up, and no other anomaly', async () => {
    const { stats } = await sweepWith();

    expect(stats.unlinkableItems.length).toBeGreaterThan(0);
    expect(stats.unlinkableItems).toEqual(
      stats.anomalies.filter((anomaly) => anomaly.kind === 'unlinkable-item'),
    );

    // A second kind is present in the same run, so "counts them all" and "counts the right ones"
    // are told apart rather than both passing on a run that has only one kind in it.
    expect(stats.unmappedTags.map((anomaly) => anomaly.kind)).toContain('unknown-slot-tag');
    expect(stats.unlinkableItems).not.toEqual(stats.anomalies);
  });
});

describe('the unmapped-tag annotation', () => {
  const annotationsWith = (githubActions, snapshot) => {
    const printed = [];
    const console_ = vi.spyOn(console, 'log').mockImplementation((line) => printed.push(line));
    vi.stubEnv('GITHUB_ACTIONS', githubActions);
    try {
      summarise(snapshot);
    } finally {
      console_.mockRestore();
      vi.unstubAllEnvs();
    }
    return printed.filter((line) => line.startsWith('::warning title=Unmapped market tags::'));
  };

  it('is raised on Actions, which is the only place that renders one', async () => {
    const { snapshot, stats } = await sweepWith();
    expect(stats.unmappedTags.length).toBeGreaterThan(0);
    expect(annotationsWith('true', snapshot)).toHaveLength(1);
  });

  it('is not printed off Actions, where it is a line nobody reads', async () => {
    const { snapshot } = await sweepWith();
    expect(annotationsWith(undefined, snapshot)).toEqual([]);
    expect(annotationsWith('false', snapshot)).toEqual([]);
  });
});
