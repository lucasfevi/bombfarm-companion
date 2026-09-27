/**
 * The seams no type reaches: that the sweep's statistics describe the pass that actually happened,
 * and that the pass it describes is the cheap one.
 *
 * The rate-limit count is read off log prose — the one line the rotation emits per 429 and the one
 * the discovery pass emits — because neither pass totals them. Reword either message and the count
 * silently goes to zero while every other suite stays green.
 *
 * And a pass must ask for nothing but the enumeration. Nothing types that: a second upstream pass
 * could be reintroduced and every unit test would stay green while an address's quota went back to
 * being spent on identifying rows it already knew. So the assertion here is on the call count and on
 * the URLs themselves, not on the absence of a function — a burst that ran and found nothing would
 * satisfy anything weaker.
 *
 * So this drives `runSweep` against a stubbed network, with no request made, down each path in turn.
 */
import { describe, expect, it, vi } from 'vitest';
import { assertWorkspaceDistBuilt } from '../require-workspace-dist.mjs';

// Per-file build guard, on this file's OWN key: the builder resolves @bombfarm/pricing through
// that package's exports map, which points at ./dist/**. The import below is dynamic so this
// assert runs first and names the unbuilt package, instead of the import dying at collection with
// an error that points nowhere near `pnpm build`.
assertWorkspaceDistBuilt('tools/market-snapshot/sweep-stats.test.mjs');

const { parsePrior, runSweep, summarise } = await import('./build.mjs');
const { SEARCH_PAGE_SIZE, priceKey, resolveKey } = await import('@bombfarm/pricing');

const CATALOG = {
  defs: [{ defId: 'coal_bota', set: 'coal', slot: 'bota', level: 30 }],
  rarityIdxs: [2],
  rarityTokens: { 2: 'raro' },
  gems: [{ defId: 'gem_topaz', name: 'Topaz', rarityIdx: 2 }],
};

const BOOTS = 'Coal Boots Lv 30 (Rare)';
const GEM = 'Topaz Gem';

/**
 * `Coal Cape (Rare)` is the row nothing can name: exactly the shape a name parser would have read as
 * the coal set in a cape slot. It is here so the unlinkable count has something to count, and so
 * "counts them all" and "counts the right ones" can be told apart on a run carrying two kinds.
 */
const UNNAMEABLE = 'Coal Cape (Rare)';

// The boots row carries a type that disagrees with the slot its name implies, which is the drift
// witness: it must be counted as drift and NOT as unlinkable, since it matched and is still keyed.
const ROWS = [
  [BOOTS, 480, 'Helmet'],
  [GEM, 250, null],
  [UNNAMEABLE, 300, null],
].map(([hashName, sellPriceCents, type]) => ({
  hashName,
  name: hashName,
  sellPriceCents,
  listings: 2,
  iconUrl: null,
  type,
}));

/** True when a search URL narrows by a market facet, which nothing in the sweep does any more. */
const narrowsByFacet = (url) =>
  [...new URL(url).searchParams.keys()].some((key) => key.startsWith('category_'));

/** Enough consecutive rate limits to trip either pass's circuit breaker. */
const PAST_THE_BREAKER = 99;

function sweepWith({ searchRateLimits = 0, quoteRateLimits = 0, currencies = ['BRL'] } = {}) {
  let searchLeft = searchRateLimits;
  let quoteLeft = quoteRateLimits;
  const lines = [];
  const searchUrls = [];

  const steamNet = {
    fetchSearchPage: (url) => {
      if (searchLeft > 0) {
        searchLeft -= 1;
        return Promise.resolve({ ok: false, rateLimited: true });
      }
      searchUrls.push(url);
      const start = Number(new URL(url).searchParams.get('start') ?? '0');
      return Promise.resolve({
        ok: true,
        page: { totalCount: ROWS.length, rows: ROWS.slice(start, start + SEARCH_PAGE_SIZE) },
      });
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
  }).then(({ snapshot, stats }) => ({ snapshot, stats, lines, searchUrls }));
}

describe('a pass asks for the enumeration and nothing else', () => {
  it('spends one search call on a board that fits one page, narrowed by no facet', async () => {
    const { stats, searchUrls } = await sweepWith({ currencies: [] });

    expect(stats.searchCalls).toBe(1);
    expect(searchUrls).toHaveLength(1);
    expect(searchUrls.some(narrowsByFacet)).toBe(false);
  });

  it('counts the walk as the whole enumeration, with no second endpoint beside it', async () => {
    const { stats } = await sweepWith({ currencies: [] });

    expect(stats.enumerationCalls).toBe(stats.searchCalls);
  });

  it('identifies the board it walked, which is the half the walk alone now buys', async () => {
    const { snapshot, stats } = await sweepWith({ currencies: [] });

    expect(stats.enumerationComplete).toBe(true);
    expect(snapshot.index[priceKey('coal_bota', 2)]).toBeDefined();
    expect(snapshot.index[priceKey('gem_topaz', 2)]).toBeDefined();
    expect(snapshot.coverage.matchedCatalogKeys).toBeGreaterThan(0);
  });
});

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

    expect(stats.unlinkableItems).toHaveLength(1);
    expect(stats.unlinkableItems[0].detail).toContain(UNNAMEABLE);
    expect(stats.unlinkableItems).toEqual(
      stats.anomalies.filter((anomaly) => anomaly.kind === 'unlinkable-item'),
    );
  });

  it('keeps the drift count apart from the unlinkable one, on a run carrying both', async () => {
    const { stats } = await sweepWith();

    expect(stats.unmappedTags.map((anomaly) => anomaly.kind)).toEqual(['name-form-drift']);
    expect(stats.unmappedTags[0].detail).toContain(BOOTS);
    expect(stats.unlinkableItems).not.toEqual(stats.unmappedTags);
  });
});

describe('the name-form drift annotation', () => {
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
    return printed.filter((line) => line.startsWith('::warning title=Market name form has moved::'));
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

/**
 * A market that answers the flat walk out of a fixed item list, so a pass can identify what it
 * enumerated and hand the snapshot it produced to the next one.
 */
const TWO_DEF_CATALOG = {
  defs: [
    { defId: 'coal_bota', set: 'coal', slot: 'bota', level: 30 },
    { defId: 'coal_elmo', set: 'coal', slot: 'elmo', level: 30 },
  ],
  rarityIdxs: [2, 3],
  rarityTokens: { 2: 'raro', 3: 'epico' },
  gems: [{ defId: 'gem_topaz', name: 'Topaz', rarityIdx: 2 }],
};

const listed = (hashName) => ({ hashName });

const LISTED_BOOTS = listed('Coal Boots Lv 30 (Rare)');
const LISTED_GEM = listed('Topaz Gem');
const LISTED_HELMET = listed('Coal Helmet Lv 30 (Epic)');

function walkedSweep({ items, prior = null, planQuotes = undefined, currencies = ['BRL'] }) {
  const searchUrls = [];

  const steamNet = {
    fetchSearchPage: (url) => {
      searchUrls.push(url);
      const start = Number(new URL(url).searchParams.get('start') ?? '0');
      return Promise.resolve({
        ok: true,
        page: {
          totalCount: items.length,
          rows: items.slice(start, start + SEARCH_PAGE_SIZE).map((entry) => ({
            hashName: entry.hashName,
            name: entry.hashName,
            sellPriceCents: 480,
            listings: 2,
            iconUrl: null,
            type: null,
          })),
        },
      });
    },
    fetchPriceOverview: () =>
      Promise.resolve({ ok: true, quote: { lowest: 25, median: 26.5, volume: 1234 } }),
    fetchFx: () => Promise.resolve({ ok: true, rates: { USD: 1, BRL: 5.4 } }),
  };

  return runSweep({
    catalog: TWO_DEF_CATALOG,
    prior,
    searchDelayMs: 0,
    quoteDelayMs: 0,
    nativeCurrencies: currencies,
    planQuotes,
    log: () => {},
    now: () => Date.parse('2026-09-01T00:00:00.000Z'),
    steamNet,
  }).then(({ snapshot, stats }) => ({ snapshot, stats, searchUrls }));
}

const BOOTS_KEY = priceKey('coal_bota', 2);
const GEM_KEY = priceKey('gem_topaz', 2);

const onlyBoots = ({ quotable }) => ({
  hashNames: quotable
    .filter((entry) => entry.hashName === LISTED_BOOTS.hashName)
    .map((entry) => entry.hashName),
});

/**
 * The half of tiering the snapshot has to carry. A row dropped from the rotation is not a row
 * whose quote is merely late — no later pass is coming for it — so the previous quote must not be
 * inherited, or the file would go on labelling an indefinitely ageing figure as the listing's own
 * price. The prior snapshot here holds a native quote for both rows, and the USD price has not
 * moved, which is exactly the condition inheritance fires on.
 */
describe('a row left to the enumeration is priced from it, and says which', () => {
  it('reports the rotation native and the row it dropped converted', async () => {
    const first = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM] });
    expect(resolveKey(GEM_KEY, first.snapshot, 'BRL').basis).toBe('native');

    const second = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      prior: first.snapshot,
      planQuotes: onlyBoots,
    });

    const boots = resolveKey(BOOTS_KEY, second.snapshot, 'BRL');
    const gem = resolveKey(GEM_KEY, second.snapshot, 'BRL');

    expect(boots.basis).toBe('native');
    expect(boots.amount).toBe(25);
    expect(gem.basis).toBe('converted');
    expect(gem.amount).toBeCloseTo(4.8 * 5.4);
    expect(gem.state).toBe('priced');
  });

  it('spends a call on the rotation only, and names both sides of the split', async () => {
    const first = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM] });
    const second = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      prior: first.snapshot,
      planQuotes: onlyBoots,
    });

    expect(first.stats.quoteCalls).toBe(2);
    expect(second.stats.quoteCalls).toBe(1);
    expect(second.stats.quotesAttempted).toBe(1);
    expect(second.stats.quotable).toBe(2);
    expect(second.stats.rotation).toEqual([LISTED_BOOTS.hashName]);
    expect(second.stats.enumerationOnly).toEqual([LISTED_GEM.hashName]);
  });

  it('paces the rotation at the delay the plan chose, not the caller default', async () => {
    const { stats } = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      planQuotes: ({ quotable }) => ({
        hashNames: quotable.map((entry) => entry.hashName),
        delayMs: 7,
      }),
    });
    expect(stats.rotationDelayMs).toBe(7);
  });

  /**
   * The plan is a policy, and a policy that named a row this pass never saw would spend a call on
   * something with nothing to price. The rotation is the expensive half of the sweep.
   */
  it('never quotes a row the plan named but the market did not list', async () => {
    const { stats } = await walkedSweep({
      items: [LISTED_BOOTS],
      planQuotes: ({ quotable }) => ({
        hashNames: [...quotable.map((entry) => entry.hashName), 'Nothing Listed (Rare)'],
      }),
    });

    expect(stats.rotation).toEqual([LISTED_BOOTS.hashName]);
    expect(stats.quoteCalls).toBe(1);
  });

  it('hands the plan the enumeration it just paid for', async () => {
    const seen = [];
    await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      planQuotes: ({ quotable, enumerationCalls, searchDelayMs }) => {
        seen.push({ enumerationCalls, searchDelayMs, quotable: quotable.length });
        return { hashNames: [] };
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].quotable).toBe(2);
    expect(seen[0].searchDelayMs).toBe(0);
    expect(seen[0].enumerationCalls).toBe(1);
  });
});

/**
 * The sweep with its expensive half switched off, which is what a caller running on a fresh
 * address every pass wants: the enumeration prices every listed row for a tenth of a call each.
 *
 * The row that had a native quote is the one worth asserting on. Its USD price has not moved, so
 * it meets the condition inheritance fires on — and inheriting it here would publish a figure no
 * later pass is coming to replace, ageing indefinitely behind the label that says it is the
 * number on the listing.
 */
describe('a sweep asked for no native currency', () => {
  it('leaves every listed row to the enumeration, whatever plan the caller brought', async () => {
    const { stats } = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      currencies: [],
      planQuotes: ({ quotable }) => ({ hashNames: quotable.map((entry) => entry.hashName) }),
    });

    expect(stats.rotation).toEqual([]);
    expect([...stats.enumerationOnly].sort()).toEqual(
      [LISTED_BOOTS.hashName, LISTED_GEM.hashName].sort(),
    );
    expect(stats.quoteCalls).toBe(0);
    expect(stats.quotesAttempted).toBe(0);
  });

  it('retires the previous pass native quotes rather than carrying them behind their label', async () => {
    const quoted = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM] });
    expect(resolveKey(BOOTS_KEY, quoted.snapshot, 'BRL').basis).toBe('native');

    const enumerated = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM],
      prior: quoted.snapshot,
      currencies: [],
    });

    const boots = resolveKey(BOOTS_KEY, enumerated.snapshot, 'BRL');
    expect(boots.state).toBe('priced');
    expect(boots.basis).toBe('converted');
    expect(boots.amount).toBeCloseTo(4.8 * 5.4);
    expect(enumerated.snapshot.nativeCurrencies).toEqual([]);
  });
});

/**
 * Identity is regenerated every pass rather than carried, so a pass that meets a row for the first
 * time costs no more than one that has seen it before. That is the property the facet sweep could
 * not have: it had to be handed the previous snapshot to stay off an ordinary pass, and forgetting
 * to hand it in brought a 150-call burst back on every one.
 */
describe('a newly listed row costs the same as a known one', () => {
  it('spends the same calls whether or not the prior names the row, and keys it either way', async () => {
    const first = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM] });
    const withHelmet = await walkedSweep({
      items: [LISTED_BOOTS, LISTED_GEM, LISTED_HELMET],
      prior: first.snapshot,
    });

    expect(withHelmet.stats.searchCalls).toBe(first.stats.searchCalls);
    expect(withHelmet.searchUrls.some(narrowsByFacet)).toBe(false);
    expect(withHelmet.snapshot.index[priceKey('coal_elmo', 3)]).toBeDefined();
    expect(withHelmet.snapshot.index[priceKey('coal_bota', 2)]).toBeDefined();
  });

  it('gives the same board on two identical passes, so nothing is inherited to drift', async () => {
    const first = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM] });
    const second = await walkedSweep({ items: [LISTED_BOOTS, LISTED_GEM], prior: first.snapshot });

    expect(second.snapshot.index).toEqual(first.snapshot.index);
    expect(second.snapshot.entries).toEqual(first.snapshot.entries);
  });
});

/**
 * The seam a pass reads its prior through, whether it came off disk or off the published file.
 * Version 2 is the case that earns the test: it predates native quotes, so it is a real published
 * shape that carries fields the merge would otherwise reason about as absent.
 */
describe('reading a prior snapshot out of a body', () => {
  const body = (overrides) =>
    JSON.stringify({
      schemaVersion: 3,
      generatedUtc: '2026-09-05T00:00:00.000Z',
      entries: [
        {
          hashName: 'Coal Boots Lv 30 (Rare)',
          key: 'coal_bota#2',
          lowestUsd: 4.8,
          lowestNative: { BRL: 26 },
          nativeQuotedUtc: '2026-09-05T00:00:00.000Z',
        },
      ],
      index: { 'coal_bota#2': 0 },
      fx: { USD: 1, BRL: 5.4 },
      ...overrides,
    });

  const quiet = () => {};

  it('reads a current body back as the snapshot it is', () => {
    const parsed = parsePrior(body(), 'the published snapshot', quiet);

    expect(parsed?.schemaVersion).toBe(3);
    expect(parsed?.entries[0].lowestNative).toEqual({ BRL: 26 });
  });

  it('normalises a body older than native quotes, rather than handing the merge holes', () => {
    const parsed = parsePrior(
      body({ schemaVersion: 2, entries: [{ hashName: 'Topaz Gem', key: 'gem#Topaz Gem', lowestUsd: 1 }] }),
      'the published snapshot',
      quiet,
    );

    expect(parsed?.schemaVersion).toBe(3);
    expect(parsed?.nativeCurrencies).toEqual([]);
    expect(parsed?.entries[0].lowestNative).toEqual({});
    expect(parsed?.entries[0].nativeQuotedUtc).toBeNull();
  });

  it.each([
    ['a body that is not JSON', '<!DOCTYPE html>'],
    ['JSON that is not a snapshot', '{"hello":"world"}'],
    ['a schema version nothing here can read', '{"schemaVersion":99,"generatedUtc":"x"}'],
  ])('answers null on %s, and says which source it gave up on', (_case, raw) => {
    const said = [];
    expect(parsePrior(raw, 'the published snapshot', (line) => said.push(line))).toBeNull();
    expect(said.join(' ')).toContain('the published snapshot');
  });
});
