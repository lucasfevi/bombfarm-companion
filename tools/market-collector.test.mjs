/**
 * The collector's decisions, driven with an injected clock, logger, sweep and transport, so every
 * one of them is exercised without a market call, a database or a build.
 *
 * The two that matter most are the ones a green suite would otherwise hide: that a pass which
 * throws still leaves a row saying so, and that the cool-down ladder resets when a pass completes.
 * Both are asserted by observing the write, not by reading a value back.
 */
import { describe, expect, it } from 'vitest';
import {
  COOL_DOWN_LADDER_MS,
  MIN_PASS_MS,
  MIN_SPACING_MS,
  createHistory,
  createLogger,
  createPublisher,
  incompleteStages,
  itemRowsFrom,
  nextCoolDown,
  quoteRowsFrom,
  readConfig,
  runCollector,
  runRowFrom,
} from './market-snapshot/collect.mjs';

const ENV = {
  SUPABASE_URL: 'https://history.example/',
  SUPABASE_KEY: 'key',
  GITHUB_TOKEN: 'token',
  GITHUB_REPO: 'owner/repo',
  MARKET_DAILY_BUDGET: '2000',
  MARKET_CURRENCY: 'BRL',
  RELEASE_TAG: 'market-prices',
  DATA_BRANCH: 'market-data',
  SNAPSHOT: '/var/state/market-prices.json',
};

const snapshotFixture = () => ({
  entries: [
    {
      hashName: 'Coal Boots (Rare)',
      key: 'coal_bota#2',
      defId: 'coal_bota',
      kind: 'equipment',
      category: 'equip',
    },
    { hashName: 'Topaz Gem', key: 'gem#Topaz Gem', defId: null, kind: 'gem', category: 'gem' },
  ],
});

const statsFixture = (overrides = {}) => ({
  rowsSeen: 2,
  searchCalls: 9,
  enumerationCalls: 10,
  quoteCalls: 1,
  quotesOk: 1,
  quotable: 2,
  rotation: ['Coal Boots (Rare)'],
  enumerationOnly: ['Topaz Gem'],
  rotationDelayMs: 43_200,
  rateLimitHits: 0,
  rateLimitHitsDerived: 0,
  enumerationComplete: true,
  discoveryComplete: true,
  quotesComplete: true,
  anomalies: [],
  unmappedTags: [],
  unlinkableItems: [],
  quotedUtc: '2026-09-01T00:00:00.000Z',
  // Only the boots were quoted; the gem is an item the market answered without a price.
  quotes: new Map([['Coal Boots (Rare)', { BRL: { lowest: 12.5, median: 13, volume: 40 } }]]),
  ...overrides,
});

const okResponse = (payload = {}) => ({
  ok: true,
  status: 200,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

const failResponse = (status = 500) => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => 'boom',
});

/** A collector wired entirely to spies, with a sensible pass unless a case overrides it. */
function harness(overrides = {}) {
  const lines = [];
  const runs = [];
  const published = [];
  const sleeps = [];
  let clockMs = 0;

  const log = createLogger({
    write: (line) => lines.push(line),
    clock: () => new Date(clockMs),
  });

  const deps = {
    config: {
      budget: 2000,
      tierWindowMs: 30 * 86_400_000,
      retierEveryMs: 86_400_000,
      snapshotPath: '/state/snap.json',
      currencies: ['BRL'],
    },
    runSweep: async () => ({ snapshot: snapshotFixture(), stats: statsFixture() }),
    loadPrior: () => null,
    writeSnapshot: () => {},
    persistHistory: async () => ({ ok: true, error: null }),
    readTiers: async () => ({ traded: new Set(), observed: new Set() }),
    publishRelease: async () => {
      published.push('release');
      return true;
    },
    publishBranch: async () => {
      published.push('branch');
      return true;
    },
    writeRun: async (row) => {
      runs.push(row);
    },
    log,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => clockMs,
    maxPasses: 1,
    ...overrides,
  };

  return {
    deps,
    lines,
    runs,
    published,
    sleeps,
    advance: (ms) => {
      clockMs += ms;
    },
  };
}

/**
 * The plan itself is proved in market-quote-plan.test.mjs. What is proved here is that the pass
 * actually runs one: that membership reaches the sweep, that it is re-read on its own interval
 * rather than once, and that a store the collector cannot read costs it the rotation rather than
 * the whole board.
 */
describe('the pass plans what it will quote', () => {
  const listed = ['Traded Item', 'Quiet Item'];

  const planningHarness = (overrides = {}) => {
    const plans = [];
    const h = harness({
      runSweep: async ({ planQuotes }) => {
        plans.push(
          planQuotes({
            quotable: listed.map((hashName) => ({ hashName })),
            enumerationCalls: 10,
            searchDelayMs: 1500,
          }),
        );
        return { snapshot: snapshotFixture(), stats: statsFixture() };
      },
      ...overrides,
    });
    return { ...h, plans };
  };

  it('quotes what the store says has traded and leaves the rest to the enumeration', async () => {
    const h = planningHarness({
      readTiers: async () => ({
        traded: new Set(['Traded Item']),
        observed: new Set(listed),
      }),
    });
    await runCollector(h.deps);

    expect(h.plans[0].hashNames).toEqual(['Traded Item']);
    expect(h.plans[0].enumerationOnly).toEqual(['Quiet Item']);
    expect(h.plans[0].spacingMs).toBeGreaterThanOrEqual(MIN_SPACING_MS);
  });

  it('asks the store for the window it was configured with', async () => {
    const asked = [];
    const h = planningHarness({
      readTiers: async (windowMs) => {
        asked.push(windowMs);
        return { traded: new Set(), observed: new Set(listed) };
      },
    });
    await runCollector(h.deps);
    expect(asked).toEqual([30 * 86_400_000]);
  });

  it('re-reads membership once the interval has passed, and not before', async () => {
    let reads = 0;
    const h = planningHarness({
      maxPasses: 3,
      readTiers: async () => {
        reads += 1;
        return { traded: new Set(), observed: new Set(listed) };
      },
      sleep: async (ms) => {
        h.advance(ms);
      },
    });
    h.deps.config.retierEveryMs = MIN_PASS_MS * 2;
    await runCollector(h.deps);

    expect(reads).toBe(2);
  });

  /**
   * Losing the readings must not lose the board. With no membership to go on the rotation is
   * everything listed, which is what the budget alone would have bought anyway.
   */
  it('quotes everything listed when the store cannot be read', async () => {
    const h = planningHarness({ readTiers: async () => null });
    await runCollector(h.deps);

    expect(h.plans[0].hashNames).toEqual(listed);
    expect(h.plans[0].firstQuote).toEqual(listed);
    expect(h.lines.map((line) => JSON.parse(line).evt)).toContain('quote.planned');
  });

  it('places an item quoted for the first time by its own result, without waiting for a re-read', async () => {
    const h = planningHarness({
      maxPasses: 2,
      readTiers: async () => null,
      runSweep: async ({ planQuotes }) => {
        const plan = planQuotes({
          quotable: listed.map((hashName) => ({ hashName })),
          enumerationCalls: 10,
          searchDelayMs: 1500,
        });
        h.plans.push(plan);
        return {
          snapshot: snapshotFixture(),
          stats: statsFixture({
            rotation: plan.hashNames,
            quotes: new Map([
              ['Traded Item', { BRL: { lowest: 1, median: 1, volume: 6 } }],
              ['Quiet Item', { BRL: { lowest: 1, median: 1, volume: 0 } }],
            ]),
          }),
        };
      },
    });
    await runCollector(h.deps);

    expect(h.plans[0].hashNames).toEqual(listed);
    expect(h.plans[1].hashNames).toEqual(['Traded Item']);
    expect(h.plans[1].enumerationOnly).toEqual(['Quiet Item']);
  });

  it('records the delay the plan chose on the run row', async () => {
    const h = planningHarness({
      readTiers: async () => ({ traded: new Set(listed), observed: new Set(listed) }),
    });
    await runCollector(h.deps);

    expect(h.runs[0].spacing_ms).toBe(h.plans[0].spacingMs);
    expect(h.runs[0].spacing_ms).toBeGreaterThan(0);
  });

  it('leaves the delay null on a pass that never got as far as planning one', async () => {
    const h = harness({
      runSweep: async () => {
        throw new Error('sweep exploded');
      },
    });
    await runCollector(h.deps);

    expect(h.runs[0].spacing_ms).toBeNull();
  });
});

describe('configuration read from the environment', () => {
  it('names the published artifact after the file it resumes from', () => {
    const config = readConfig(ENV);
    expect(config.snapshotPath).toBe('/var/state/market-prices.json');
    expect(config.snapshotName).toBe('market-prices.json');
  });

  it('refuses to start without a credential rather than failing on the first call', () => {
    const missing = { ...ENV };
    delete missing.SUPABASE_KEY;
    expect(() => readConfig(missing)).toThrow(/SUPABASE_KEY/);
  });

  /**
   * The process is restarted on failure, so reporting one variable per start costs a whole
   * restart cycle to discover each next one. Every problem has to come out of the first start.
   */
  it('names every missing variable and a bad budget in one message, not the first one only', () => {
    const broken = { ...ENV, MARKET_DAILY_BUDGET: 'abc' };
    delete broken.SUPABASE_KEY;
    delete broken.GITHUB_TOKEN;

    let thrown;
    try {
      readConfig(broken);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeDefined();
    expect(thrown.message).toMatch(/SUPABASE_KEY/);
    expect(thrown.message).toMatch(/GITHUB_TOKEN/);
    expect(thrown.message).toMatch(/MARKET_DAILY_BUDGET/);
  });

  it.each([
    ['GITHUB_REPO', 'GITHUB_REPOSITORY', 'repo', 'owner/repo'],
    ['SNAPSHOT', 'MARKET_SNAPSHOT_PATH', 'snapshotPath', '/var/state/market-prices.json'],
    ['RELEASE_TAG', 'MARKET_RELEASE_TAG', 'releaseTag', 'market-prices'],
    ['DATA_BRANCH', 'MARKET_DATA_BRANCH', 'dataBranch', 'market-data'],
  ])('reads %s under its longer name %s too', (canonical, alias, field, value) => {
    const aliased = { ...ENV, [alias]: value };
    delete aliased[canonical];
    expect(readConfig(aliased)[field]).toBe(value);
  });

  it('turns the tiering intervals into milliseconds', () => {
    const config = readConfig({ ...ENV, MARKET_TIER_WINDOW_DAYS: '7', MARKET_RETIER_HOURS: '6' });
    expect(config.tierWindowMs).toBe(7 * 86_400_000);
    expect(config.retierEveryMs).toBe(6 * 3_600_000);
  });

  it.each(['MARKET_TIER_WINDOW_DAYS', 'MARKET_RETIER_HOURS'])(
    'names a nonsensical %s in the same message as everything else wrong',
    (name) => {
      expect(() => readConfig({ ...ENV, [name]: '-1' })).toThrow(name);
    },
  );

  it('starts on an environment carrying only the four that have no sane default', () => {
    const minimal = {
      SUPABASE_URL: ENV.SUPABASE_URL,
      SUPABASE_KEY: ENV.SUPABASE_KEY,
      GITHUB_TOKEN: ENV.GITHUB_TOKEN,
      GITHUB_REPO: ENV.GITHUB_REPO,
    };
    expect(readConfig(minimal)).toMatchObject({
      budget: 2000,
      tierWindowMs: 30 * 86_400_000,
      retierEveryMs: 24 * 3_600_000,
      currencies: ['BRL'],
      releaseTag: 'market-prices',
      dataBranch: 'market-data',
      snapshotName: 'market-prices.json',
    });
  });
});

describe('the rows a pass produces', () => {
  it('writes no quote row for an item the market answered without a price', () => {
    const rows = quoteRowsFrom(statsFixture());
    expect(rows).toEqual([
      {
        hash_name: 'Coal Boots (Rare)',
        currency: 'BRL',
        quoted_at: '2026-09-01T00:00:00.000Z',
        lowest: 12.5,
        median: 13,
        volume: 40,
      },
    ]);
    expect(rows.map((row) => row.hash_name)).not.toContain('Topaz Gem');
  });

  it('carries the median and the volume the rotation already paid for', () => {
    const [row] = quoteRowsFrom(statsFixture());
    expect(row.median).toBe(13);
    expect(row.volume).toBe(40);
  });

  it('never sends a first-seen column, which an upsert would reset every pass', () => {
    const rows = itemRowsFrom(snapshotFixture(), '2026-09-01T00:00:00.000Z');
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(Object.keys(row)).not.toContain('first_seen');
    expect(rows[0].last_seen).toBe('2026-09-01T00:00:00.000Z');
  });

  it('counts the anomalies the pass saw onto the run row', () => {
    const stats = statsFixture({
      anomalies: [
        { kind: 'unlinkable-item', detail: 'x' },
        { kind: 'unknown-slot-tag', detail: 'y' },
      ],
      unmappedTags: [{ kind: 'unknown-slot-tag', detail: 'y' }],
      unlinkableItems: [{ kind: 'unlinkable-item', detail: 'x' }],
    });
    expect(runRowFrom(stats, 1234)).toMatchObject({
      anomalies: 2,
      unmapped_tags: 1,
      unlinkable_items: 1,
      snapshot_bytes: 1234,
    });
  });
});

describe('the cool-down ladder', () => {
  it('climbs on failure and stops at the top rung', () => {
    const climb = [];
    let current = 0;
    for (let i = 0; i < 6; i += 1) {
      current = nextCoolDown(current);
      climb.push(current);
    }
    expect(climb).toEqual([
      ...COOL_DOWN_LADDER_MS.slice(1),
      COOL_DOWN_LADDER_MS.at(-1),
      COOL_DOWN_LADDER_MS.at(-1),
    ]);
  });

  it('advances across passes that fail', async () => {
    const h = harness({
      maxPasses: 3,
      runSweep: async () => {
        throw new Error('sweep exploded');
      },
    });
    await runCollector(h.deps);
    expect(h.sleeps).toEqual([15 * 60_000, 30 * 60_000, 60 * 60_000]);
  });

  it('resets to nothing after a pass that completes', async () => {
    let call = 0;
    const h = harness({
      maxPasses: 3,
      runSweep: async () => {
        call += 1;
        if (call < 3) throw new Error('sweep exploded');
        return { snapshot: snapshotFixture(), stats: statsFixture() };
      },
    });
    await runCollector(h.deps);
    expect(h.sleeps.slice(0, 2)).toEqual([15 * 60_000, 30 * 60_000]);
    expect(h.sleeps.at(-1)).toBe(MIN_PASS_MS);
  });

  it('names every stage that did not finish, and nothing when all of them did', () => {
    expect(incompleteStages(statsFixture())).toEqual([]);
    expect(incompleteStages(statsFixture({ enumerationComplete: false }))).toEqual(['enumerate']);
    expect(incompleteStages(statsFixture({ discoveryComplete: false }))).toEqual(['tag']);
    expect(incompleteStages(statsFixture({ quotesComplete: false }))).toEqual(['quote']);
  });

  it('treats a stage that never reported as unfinished, not as finished', () => {
    const silent = statsFixture();
    delete silent.discoveryComplete;
    expect(incompleteStages(silent)).toEqual(['tag']);
  });

  it('climbs when a pass dies enumerating, though it never reached a quote to fail at', async () => {
    // The witnessed shape: enumeration broke, so the rotation was never entered and reports
    // itself complete having had nothing to leave undone. Reading that alone reset the ladder.
    const diedEnumerating = statsFixture({
      enumerationComplete: false,
      discoveryComplete: false,
      quotesComplete: true,
      rowsSeen: 0,
      searchCalls: 6,
      quoteCalls: 0,
      quotesOk: 0,
      rateLimitHits: 5,
      quotes: new Map(),
    });

    const h = harness({
      maxPasses: 3,
      runSweep: async () => ({ snapshot: snapshotFixture(), stats: diedEnumerating }),
    });
    await runCollector(h.deps);

    expect(h.sleeps).toEqual([15 * 60_000, 30 * 60_000, 60 * 60_000]);
  });

  it('climbs when a pass dies tagging, having enumerated and quoted nothing', async () => {
    const h = harness({
      maxPasses: 2,
      runSweep: async () => ({
        snapshot: snapshotFixture(),
        stats: statsFixture({ discoveryComplete: false, quotesOk: 0, quotes: new Map() }),
      }),
    });
    await runCollector(h.deps);

    expect(h.sleeps).toEqual([15 * 60_000, 30 * 60_000]);
  });

  it('enters the ladder for a rotation cut short, while still publishing and persisting it', async () => {
    const persisted = [];
    const h = harness({
      runSweep: async () => ({
        snapshot: snapshotFixture(),
        stats: statsFixture({ quotesComplete: false }),
      }),
      persistHistory: async (snapshot) => {
        persisted.push(snapshot);
        return { ok: true, error: null };
      },
    });
    await runCollector(h.deps);

    expect(persisted).toHaveLength(1);
    expect(h.published).toEqual(['release', 'branch']);
    expect(h.runs[0].error).toBeUndefined();
    expect(h.sleeps).toEqual([15 * 60_000]);
  });
});

describe('the pass', () => {
  it('writes a run row carrying the error when the pass throws', async () => {
    const h = harness({
      runSweep: async () => {
        throw new Error('sweep exploded');
      },
    });
    await runCollector(h.deps);

    expect(h.runs).toHaveLength(1);
    expect(h.runs[0].error).toMatch(/sweep exploded/);
    expect(h.runs[0].finished_at).toBeTruthy();
  });

  it('persists the readings before it publishes, because a reading not taken cannot be redone', async () => {
    const order = [];
    const h = harness({
      persistHistory: async () => {
        order.push('history');
        return { ok: true, error: null };
      },
      publishRelease: async () => {
        order.push('release');
        return true;
      },
      publishBranch: async () => {
        order.push('branch');
        return true;
      },
    });
    await runCollector(h.deps);
    expect(order).toEqual(['history', 'release', 'branch']);
  });

  it('publishes anyway when the history write failed, and records that it did', async () => {
    const h = harness({
      persistHistory: async () => ({ ok: false, error: 'history: quote answered 503' }),
    });
    await runCollector(h.deps);

    expect(h.published).toEqual(['release', 'branch']);
    expect(h.runs[0].error).toBe('history: quote answered 503');
    expect(h.runs[0].published_release).toBe(true);
  });

  it('marks a lost reading apart from a lost pass, both sharing one error column', async () => {
    const lostReading = harness({
      persistHistory: async () => ({ ok: false, error: 'history: quote answered 503' }),
    });
    await runCollector(lostReading.deps);

    const lostPass = harness({
      runSweep: async () => {
        throw new Error('sweep exploded');
      },
    });
    await runCollector(lostPass.deps);

    expect(lostReading.runs[0].error.startsWith('history: ')).toBe(true);
    expect(lostPass.runs[0].error.startsWith('history: ')).toBe(false);
    for (const run of [lostReading.runs[0], lostPass.runs[0]]) expect(run.error).toBeTruthy();
  });

  it('records the two publish targets independently', async () => {
    const h = harness({ publishRelease: async () => false });
    await runCollector(h.deps);

    expect(h.runs[0].published_release).toBe(false);
    expect(h.runs[0].published_branch).toBe(true);
  });

  it('holds a fast pass to the publish floor and does not extend a slow one', async () => {
    const fast = harness();
    await runCollector(fast.deps);
    expect(fast.sleeps).toEqual([MIN_PASS_MS]);

    let slow;
    slow = harness({
      runSweep: async () => {
        slow.advance(MIN_PASS_MS * 2);
        return { snapshot: snapshotFixture(), stats: statsFixture() };
      },
    });
    await runCollector(slow.deps);
    expect(slow.sleeps).toEqual([0]);
  });
});

describe('the log', () => {
  it('emits one parseable object per line, each with a timestamp, a level and a dotted event', async () => {
    const h = harness({
      runSweep: async ({ log }) => {
        log('tagged 2 rows in 9 calls');
        return {
          snapshot: snapshotFixture(),
          stats: statsFixture({
            quotesComplete: false,
            unmappedTags: [{ kind: 'unknown-slot-tag', detail: 'slot xyz' }],
            unlinkableItems: [
              { kind: 'unlinkable-item', detail: 'Topaz Gem (category gem) is priced' },
            ],
          }),
        };
      },
    });
    await runCollector(h.deps);

    expect(h.lines.length).toBeGreaterThan(0);
    const events = h.lines.map((line) => JSON.parse(line));
    for (const event of events) {
      expect(typeof event.ts).toBe('string');
      expect(['info', 'warn', 'error']).toContain(event.lvl);
      expect(event.evt).toMatch(/^[a-z]+\.[A-Za-z]+$/);
    }

    const byEvent = new Map(events.map((event) => [event.evt, event]));
    expect(byEvent.get('items.unlinkable').details[0]).toMatch(/Topaz Gem/);
    expect(byEvent.get('items.unlinkable').lvl).toBe('warn');
    expect(byEvent.get('tags.unmapped').lvl).toBe('warn');
    expect(byEvent.get('quote.circuitBroken').lvl).toBe('error');
    expect(byEvent.get('sweep.line').message).toBe('tagged 2 rows in 9 calls');
  });

  it('says outright that a pass collected nothing, and which stage cost it', async () => {
    const h = harness({
      runSweep: async () => ({
        snapshot: snapshotFixture(),
        stats: statsFixture({
          enumerationComplete: false,
          discoveryComplete: false,
          rowsSeen: 0,
          searchCalls: 6,
          quoteCalls: 0,
          quotesOk: 0,
          rateLimitHits: 5,
          quotes: new Map(),
        }),
      }),
    });
    await runCollector(h.deps);

    const byEvent = new Map(h.lines.map((line) => JSON.parse(line)).map((e) => [e.evt, e]));
    expect(byEvent.get('pass.collectedNothing')).toMatchObject({
      lvl: 'error',
      rows: 0,
      searchCalls: 6,
      quoteCalls: 0,
      rateLimitHits: 5,
    });
    expect(byEvent.get('pass.incomplete')).toMatchObject({
      lvl: 'error',
      stages: ['enumerate', 'tag'],
      quoted: 0,
    });
  });

  it('stays quiet about both when the pass finished and collected', async () => {
    const h = harness();
    await runCollector(h.deps);

    const events = h.lines.map((line) => JSON.parse(line).evt);
    expect(events).not.toContain('pass.collectedNothing');
    expect(events).not.toContain('pass.incomplete');
  });
});

describe('the history transport', () => {
  const historyWith = (fetch, lines = []) =>
    createHistory({
      url: 'https://history.example',
      key: 'key',
      fetch,
      log: createLogger({ write: (line) => lines.push(line), clock: () => new Date(0) }),
      now: () => 0,
    });

  it('sends one batched insert per table and asks for no rows back', async () => {
    const calls = [];
    const { persistHistory } = historyWith(async (url, init) => {
      calls.push({ url, init });
      return okResponse();
    });

    const result = await persistHistory(snapshotFixture(), statsFixture());

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://history.example/rest/v1/quote');
    expect(JSON.parse(calls[0].init.body)).toHaveLength(1);
    expect(calls[0].init.headers.Prefer).toBe('return=minimal');
    expect(calls[1].url).toBe('https://history.example/rest/v1/market_item?on_conflict=hash_name');
    expect(calls[1].init.headers.Prefer).toBe('resolution=merge-duplicates,return=minimal');
  });

  it('reports a rejected write instead of throwing it into the pass', async () => {
    const lines = [];
    const { persistHistory } = historyWith(async () => failResponse(503), lines);

    const result = await persistHistory(snapshotFixture(), statsFixture());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/503/);
    expect(lines.map((line) => JSON.parse(line).evt)).toContain('history.failed');
  });

  it('swallows a rejected run row, because it is written from a finally', async () => {
    const lines = [];
    const { writeRun } = historyWith(async () => failResponse(401), lines);
    await expect(writeRun({ pass: 1 })).resolves.toBeUndefined();
    expect(lines.map((line) => JSON.parse(line).evt)).toContain('run.failed');
  });

  describe('reading back which items have traded', () => {
    it('asks only for the window, and sorts the two sets out of the readings', async () => {
      const calls = [];
      const { readTiers } = historyWith(async (url, init) => {
        calls.push({ url, init });
        return okResponse([
          { hash_name: 'Traded Item', volume: 4 },
          { hash_name: 'Traded Item', volume: 0 },
          { hash_name: 'Quiet Item', volume: 0 },
        ]);
      });

      const tiers = await readTiers(86_400_000);

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain('quoted_at=gte.1969-12-31T00%3A00%3A00.000Z');
      expect(calls[0].init.method).toBe('GET');
      expect([...tiers.traded]).toEqual(['Traded Item']);
      expect([...tiers.observed]).toEqual(['Traded Item', 'Quiet Item']);
    });

    it('keeps asking while a page comes back full, and stops on the first short one', async () => {
      const ranges = [];
      const { readTiers } = historyWith(async (url, init) => {
        ranges.push(init.headers.Range);
        const full = ranges.length === 1;
        return okResponse(
          Array.from({ length: full ? 1000 : 3 }, (_, index) => ({
            hash_name: `Item ${String(index)}`,
            volume: 1,
          })),
        );
      });

      const tiers = await readTiers(86_400_000);

      expect(ranges).toEqual(['0-999', '1000-1999']);
      expect(tiers.traded.size).toBe(1000);
    });

    /**
     * Answering with a partial set would retire every traded item the read did not reach, which
     * is the opposite of what the rotation exists for. The caller keeps what it had instead.
     */
    it('answers with nothing at all rather than a partial set', async () => {
      const lines = [];
      const { readTiers } = historyWith(async () => failResponse(503), lines);

      await expect(readTiers(86_400_000)).resolves.toBeNull();
      expect(lines.map((line) => JSON.parse(line).evt)).toContain('tier.readFailed');
    });
  });
});

describe('publishing', () => {
  const publisherWith = (fetch, lines = [], dataBranch = 'market-data') =>
    createPublisher({
      token: 'token',
      repo: 'owner/repo',
      releaseTag: 'market-prices',
      dataBranch,
      snapshotName: 'market-prices.json',
      fetch,
      log: createLogger({ write: (line) => lines.push(line), clock: () => new Date(0) }),
      now: () => 0,
    });

  it('replaces the existing asset, there being no replace call to make', async () => {
    const calls = [];
    const { publishRelease } = publisherWith(async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/releases/tags/market-prices')) {
        return okResponse({ id: 7, assets: [{ id: 99, name: 'market-prices.json' }] });
      }
      return okResponse();
    });

    expect(await publishRelease('{}')).toBe(true);
    expect(calls).toEqual([
      'GET https://api.github.com/repos/owner/repo/releases/tags/market-prices',
      'DELETE https://api.github.com/repos/owner/repo/releases/assets/99',
      'POST https://uploads.github.com/repos/owner/repo/releases/7/assets?name=market-prices.json',
    ]);
  });

  it('retries the upload exactly once, then records the target as failed rather than throwing', async () => {
    let uploads = 0;
    const { publishRelease } = publisherWith(async (url) => {
      if (url.endsWith('/releases/tags/market-prices')) return okResponse({ id: 7, assets: [] });
      uploads += 1;
      return failResponse(502);
    });

    await expect(publishRelease('{}')).resolves.toBe(false);
    expect(uploads).toBe(2);
  });

  /**
   * Every blob gets its own sha, so the pushed tree can be read back as path → content. A shared
   * sha would let a tree that points two paths at the same blob pass as though both were written.
   */
  const capturingPublisher = (dataBranch = 'market-data') => {
    const bodies = new Map();
    const blobsBySha = new Map();
    const { publishBranch } = publisherWith(
      async (url, init) => {
        const path = url.split('/repos/owner/repo/')[1];
        const body = init?.body ? JSON.parse(init.body) : null;
        if (body) bodies.set(path, [...(bodies.get(path) ?? []), body]);
        if (path === 'git/blobs') {
          const sha = `blob${String(blobsBySha.size)}`;
          blobsBySha.set(sha, Buffer.from(body.content, 'base64').toString('utf-8'));
          return okResponse({ sha });
        }
        return okResponse({ sha: 'deadbeef' });
      },
      [],
      dataBranch,
    );
    const last = (path) => bodies.get(path)?.at(-1);
    const committed = () =>
      new Map(last('git/trees').tree.map((entry) => [entry.path, blobsBySha.get(entry.sha)]));
    return { publishBranch, last, committed };
  };

  it('commits the data branch with no parent, so it stays one commit forever', async () => {
    const { publishBranch, last, committed } = capturingPublisher();

    expect(await publishBranch('{"a":1}')).toBe(true);
    expect(last('git/commits').parents).toEqual([]);
    expect(last('git/refs/heads/market-data')).toEqual({ sha: 'deadbeef', force: true });
    expect(committed().get('market-prices.json')).toBe('{"a":1}');
  });

  /**
   * A push to this branch would otherwise start a preview build of a tree with no application in
   * it, which fails and mails the owner on every pass. The opt-out only works if it is in the
   * pushed commit, so what is read back is the tree rather than the config's text — and it must
   * name the branch actually being pushed, not one spelled into the config.
   */
  it.each(['market-data', 'market-elsewhere'])(
    'commits a deployment opt-out naming %s, at every path it is read from',
    async (dataBranch) => {
      const { publishBranch, committed } = capturingPublisher(dataBranch);

      expect(await publishBranch('{"a":1}')).toBe(true);

      const tree = committed();
      for (const path of ['vercel.json', 'apps/web/vercel.json']) {
        expect(JSON.parse(tree.get(path) ?? 'null')?.git?.deploymentEnabled).toEqual({
          [dataBranch]: false,
        });
      }
    },
  );

  it('leaves the flag of the other target alone when one of them fails', async () => {
    const { publishRelease, publishBranch } = publisherWith(async (url) => {
      if (url.startsWith('https://api.github.com/repos/owner/repo/git/')) {
        return okResponse({ sha: 'x' });
      }
      return failResponse(500);
    });

    expect(await publishRelease('{}')).toBe(false);
    expect(await publishBranch('{}')).toBe(true);
  });
});
