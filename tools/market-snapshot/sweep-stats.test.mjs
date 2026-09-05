/**
 * The seams no type reaches: that the sweep's statistics describe the pass that actually happened,
 * and that the pass it describes is the cheap one.
 *
 * The rate-limit count is read off log prose — the one line the rotation emits per 429 and the one
 * the discovery pass emits — because neither pass totals them. Reword either message and the count
 * silently goes to zero while every other suite stays green.
 *
 * The facet sweep is the burst that spends an address's quota, and the only thing keeping it off
 * an ordinary pass is the previous snapshot reaching discovery. Nothing types that hand-off:
 * drop it and every unit test stays green while the burst comes back on every pass.
 *
 * So this drives `runSweep` against a stubbed network, with no request made, down each path in
 * turn. That is what this file is for, and it is what makes both safe to depend on.
 */
import { describe, expect, it, vi } from 'vitest';
import { assertWorkspaceDistBuilt } from '../require-workspace-dist.mjs';

// Per-file build guard, on this file's OWN key: the builder resolves @bombfarm/pricing through
// that package's exports map, which points at ./dist/**. The import below is dynamic so this
// assert runs first and names the unbuilt package, instead of the import dying at collection with
// an error that points nowhere near `pnpm build`.
assertWorkspaceDistBuilt('tools/market-snapshot/sweep-stats.test.mjs');

const { runSweep, summarise } = await import('./build.mjs');
const { SEARCH_PAGE_SIZE, priceKey, resolveKey } = await import('@bombfarm/pricing');

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

/**
 * A market that answers facet-narrowed queries the way Steam does — a query for a tag returns
 * exactly the rows carrying it — so a pass can identify what it enumerated and hand the snapshot
 * it produced to the next one.
 */
const TAGGED_CATALOG = {
  defs: [
    { defId: 'coal_bota', set: 'coal', slot: 'bota', level: 30 },
    { defId: 'coal_elmo', set: 'coal', slot: 'elmo', level: 30 },
  ],
  rarityIdxs: [2, 3],
  rarityTokens: { 2: 'raro', 3: 'epico' },
  defIdByHash: { 'Topaz Gem': 'gem_topaz' },
  sets: ['coal'],
  slots: ['bota', 'elmo'],
};

const listed = (hashName, tags) => ({ hashName, tags });

const BOOTS = listed('Coal Boots Lv 30 (Rare)', {
  category: 'equip',
  set: 'coal',
  slot: 'boots',
  rarity: 'rare',
  level: '30',
});
const GEM = listed('Topaz Gem', { category: 'gem', rarity: 'rare' });
const HELMET = listed('Coal Helmet Lv 30 (Epic)', {
  category: 'equip',
  set: 'coal',
  slot: 'helmet',
  rarity: 'epic',
  level: '30',
});

const TAGGED_FILTERS = {
  success: true,
  facets: {
    a: { name: 'category', tags: { equip: {}, gem: {} } },
    b: { name: 'set', tags: { coal: {} } },
    c: { name: 'slot', tags: { boots: {}, helmet: {} } },
    d: { name: 'rarity', tags: { rare: {}, epic: {} } },
    e: { name: 'level', tags: { 30: {} } },
  },
};

/** The facet each search URL narrows by, as `facet=tag`, or `''` for the flat enumeration. */
function narrowingOf(url) {
  const narrow = {};
  for (const [key, value] of new URL(url).searchParams) {
    const facet = /^category_\d+_(.+)\[\]$/.exec(key)?.[1];
    if (facet != null) narrow[facet] = value.replace(/^tag_/, '');
  }
  return narrow;
}

function taggedSweep({ items, prior = null, planQuotes = undefined, currencies = ['BRL'] }) {
  const facetQueries = [];

  const steamNet = {
    fetchAppFilters: () => Promise.resolve(TAGGED_FILTERS),
    fetchSearchPage: (url) => {
      const narrow = narrowingOf(url);
      const asked = Object.entries(narrow).map(([facet, tag]) => `${facet}=${tag}`);
      if (asked.length > 0) facetQueries.push(asked.join(','));

      const matching = items.filter((item) =>
        Object.entries(narrow).every(([facet, tag]) => item.tags[facet] === tag),
      );
      const start = Number(new URL(url).searchParams.get('start') ?? '0');
      return Promise.resolve({
        ok: true,
        page: {
          totalCount: matching.length,
          rows: matching.slice(start, start + SEARCH_PAGE_SIZE).map((item) => ({
            hashName: item.hashName,
            name: item.hashName,
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
    catalog: TAGGED_CATALOG,
    prior,
    searchDelayMs: 0,
    quoteDelayMs: 0,
    nativeCurrencies: currencies,
    planQuotes,
    log: () => {},
    now: () => Date.parse('2026-09-01T00:00:00.000Z'),
    steamNet,
  }).then(({ snapshot, stats }) => ({ snapshot, stats, facetQueries }));
}

const BOOTS_KEY = priceKey('coal_bota', 2);
const GEM_KEY = priceKey('gem_topaz', 2);

const onlyBoots = ({ quotable }) => ({
  hashNames: quotable
    .filter((entry) => entry.hashName === BOOTS.hashName)
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
    const first = await taggedSweep({ items: [BOOTS, GEM] });
    expect(resolveKey(GEM_KEY, first.snapshot, 'BRL').basis).toBe('native');

    const second = await taggedSweep({
      items: [BOOTS, GEM],
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
    const first = await taggedSweep({ items: [BOOTS, GEM] });
    const second = await taggedSweep({
      items: [BOOTS, GEM],
      prior: first.snapshot,
      planQuotes: onlyBoots,
    });

    expect(first.stats.quoteCalls).toBe(2);
    expect(second.stats.quoteCalls).toBe(1);
    expect(second.stats.quotesAttempted).toBe(1);
    expect(second.stats.quotable).toBe(2);
    expect(second.stats.rotation).toEqual([BOOTS.hashName]);
    expect(second.stats.enumerationOnly).toEqual([GEM.hashName]);
  });

  it('paces the rotation at the delay the plan chose, not the caller default', async () => {
    const { stats } = await taggedSweep({
      items: [BOOTS, GEM],
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
    const { stats } = await taggedSweep({
      items: [BOOTS],
      planQuotes: ({ quotable }) => ({
        hashNames: [...quotable.map((entry) => entry.hashName), 'Nothing Listed (Rare)'],
      }),
    });

    expect(stats.rotation).toEqual([BOOTS.hashName]);
    expect(stats.quoteCalls).toBe(1);
  });

  it('hands the plan the enumeration it just paid for, the facet schema included', async () => {
    const seen = [];
    await taggedSweep({
      items: [BOOTS, GEM],
      planQuotes: ({ quotable, enumerationCalls, searchDelayMs }) => {
        seen.push({ enumerationCalls, searchDelayMs, quotable: quotable.length });
        return { hashNames: [] };
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].quotable).toBe(2);
    expect(seen[0].searchDelayMs).toBe(0);
    expect(seen[0].enumerationCalls).toBeGreaterThan(1);
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
    const { stats } = await taggedSweep({
      items: [BOOTS, GEM],
      currencies: [],
      planQuotes: ({ quotable }) => ({ hashNames: quotable.map((entry) => entry.hashName) }),
    });

    expect(stats.rotation).toEqual([]);
    expect([...stats.enumerationOnly].sort()).toEqual([BOOTS.hashName, GEM.hashName].sort());
    expect(stats.quoteCalls).toBe(0);
    expect(stats.quotesAttempted).toBe(0);
  });

  it('retires the previous pass native quotes rather than carrying them behind their label', async () => {
    const quoted = await taggedSweep({ items: [BOOTS, GEM] });
    expect(resolveKey(BOOTS_KEY, quoted.snapshot, 'BRL').basis).toBe('native');

    const enumerated = await taggedSweep({
      items: [BOOTS, GEM],
      prior: quoted.snapshot,
      currencies: [],
    });

    const boots = resolveKey(BOOTS_KEY, enumerated.snapshot, 'BRL');
    expect(boots.state).toBe('priced');
    expect(boots.basis).toBe('converted');
    expect(boots.amount).toBeCloseTo(4.8 * 5.4);
    expect(enumerated.snapshot.nativeCurrencies).toEqual([]);
  });

  it('still enumerates and identifies the board, which is the half it keeps', async () => {
    const { snapshot, stats } = await taggedSweep({ items: [BOOTS, GEM], currencies: [] });

    expect(stats.enumerationComplete).toBe(true);
    expect(snapshot.index[BOOTS_KEY]).toBeDefined();
    expect(snapshot.index[GEM_KEY]).toBeDefined();
    expect(snapshot.coverage.matchedCatalogKeys).toBeGreaterThan(0);
  });
});

describe('the facet sweep runs only when the enumeration turns up something new', () => {
  it('asks for every tag on a pass with no prior, and identifies what answers', async () => {
    const first = await taggedSweep({ items: [BOOTS, GEM] });

    expect(first.stats.facetSweepRan).toBe(true);
    expect(first.facetQueries).toContain('slot=boots');
    expect(first.snapshot.index[priceKey('coal_bota', 2)]).toBeDefined();
    expect(first.snapshot.index[priceKey('gem_topaz', 2)]).toBeDefined();
  });

  it('asks for none at all on the next pass, and prices the same board off the prior tags', async () => {
    const first = await taggedSweep({ items: [BOOTS, GEM] });
    const second = await taggedSweep({ items: [BOOTS, GEM], prior: first.snapshot });

    expect(second.facetQueries).toEqual([]);
    expect(second.stats.facetSweepRan).toBe(false);
    expect(second.stats.searchCalls).toBe(1);
    expect(second.stats.searchCalls).toBeLessThan(first.stats.searchCalls);
    expect(second.snapshot.index).toEqual(first.snapshot.index);
    expect(second.snapshot.entries).toEqual(first.snapshot.entries);
  });

  it('asks for them again once one row is unrecognised, and identifies that row', async () => {
    const first = await taggedSweep({ items: [BOOTS, GEM] });
    const withHelmet = await taggedSweep({ items: [BOOTS, GEM, HELMET], prior: first.snapshot });

    expect(withHelmet.stats.facetSweepRan).toBe(true);
    expect(withHelmet.facetQueries).toContain('slot=helmet');
    expect(withHelmet.snapshot.index[priceKey('coal_elmo', 3)]).toBeDefined();
    expect(withHelmet.snapshot.index[priceKey('coal_bota', 2)]).toBeDefined();
  });
});
