#!/usr/bin/env node
// Build the Steam Community Market snapshot for the app's items and write it as one JSON file.
//
//   node tools/market-snapshot/build.mjs                 # full sweep -> market-prices.json
//   OUT=snap.json DELAY_MS=500 node tools/market-snapshot/build.mjs
//
// This is the ONLY place that talks to Steam. @bombfarm/pricing holds the sweep, the
// reconciliation and the resolver as pure functions with the network injected here, so the
// shipped web and desktop apps never call Steam — they download the published snapshot.
//
// Resumes from an existing OUT file: a run cut short by Steam's IP quota keeps the rows the
// previous run published rather than shrinking the snapshot to what it managed to reach.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MARKET_APP_ID,
  appFiltersUrl,
  buildSnapshot,
  catalogKeysLost,
  discoverMarket,
  knownTagsFrom,
  readMarketSnapshot,
  parsePriceOverview,
  parseSearchPage,
  quoteNative,
  reconcile,
  steamRarityFor,
  steamSlotFor,
} from '@bombfarm/pricing';

/**
 * `Épico` -> `epico`: the token a `def_id` spells a rarity with. Derived from the catalog's own
 * label rather than its `code`, because the account fixtures carry `time_part_epico` where the
 * code for that rarity is `superraro`.
 */
const defIdToken = (label) =>
  label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const CATALOG_PATH = fileURLToPath(new URL('../../packages/domain/src/data/catalog.json', import.meta.url));
const WIKI_PATH = fileURLToPath(new URL('../../packages/domain/src/data/phase-wiki.json', import.meta.url));
const FRANKFURTER_LATEST = 'https://api.frankfurter.app/latest?from=USD';
const USER_AGENT = 'Bomb Farm Companion market snapshot (+https://github.com/lucasfevi/bombfarm-companion)';

const OUT = process.env.OUT ?? 'market-prices.json';
const APP_ID = process.env.APP_ID ? Number(process.env.APP_ID) : MARKET_APP_ID;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 1500;
/**
 * Currencies to ask Steam to quote directly. `search/render` ignores its own `currency` parameter
 * — measured 2026-08-29, it answered a BRL request with `$3.65 USD` — so a currency that must
 * match the page an item links to costs one `priceoverview` call per item.
 */
/**
 * The quote endpoint has a tighter per-IP budget than the search one. A full 53-row BRL pass at
 * 3.5s drew zero 429s when measured; the search pass's 1.5s would put it near 40 calls a minute,
 * which is over the rate this endpoint has been seen to tolerate.
 */
const QUOTE_DELAY_MS = process.env.QUOTE_DELAY_MS ? Number(process.env.QUOTE_DELAY_MS) : 3500;
const NATIVE_CURRENCIES = (process.env.NATIVE_CURRENCIES ?? 'BRL')
  .split(',')
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultLog = (message) => console.log(`[market-snapshot] ${message}`);

/**
 * `Topaz` -> `Topaz Gem` -> `gem_topaz`. Steam's market hash for a gem is its display name plus
 * " Gem", which holds for every gem the market has ever listed. Derived here rather than tabled in
 * @bombfarm/pricing: pricing is imported by both shipped apps, and pulling the wiki bundle into it
 * to answer nine gem names would ship the whole file to the renderer.
 */
function gemDefIdsByHash() {
  const wiki = JSON.parse(readFileSync(WIKI_PATH, 'utf-8'));
  return Object.fromEntries(wiki.gems.list.map((gem) => [`${gem.name} Gem`, gem.defId]));
}

export function loadCatalog() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  return {
    defs: raw.defs.map((def) => ({
      defId: def.id,
      set: def.set,
      slot: def.slot,
      level: def.nativeLevel,
    })),
    rarityIdxs: raw.rarities.map((rarity) => rarity.idx),
    rarityTokens: Object.fromEntries(
      raw.rarities.map((rarity) => [rarity.idx, defIdToken(rarity.label)]),
    ),
    defIdByHash: gemDefIdsByHash(),
    sets: raw.sets,
    slots: raw.slots,
  };
}

/**
 * Fallback tags for the tagging passes, from the catalog rather than from `appfilters`, which was
 * measured omitting a slot that had a live listing.
 */
function steamTagsFor(catalog, log) {
  const missing = [];
  const translate = (values, translator, label) =>
    values
      .map((value) => {
        const tag = translator(value);
        if (tag == null) missing.push(`${label} ${String(value)}`);
        return tag;
      })
      .filter((tag) => tag != null);

  const tags = {
    set: catalog.sets,
    slot: translate(catalog.slots, steamSlotFor, 'slot'),
    rarity: translate(catalog.rarityIdxs, steamRarityFor, 'rarity'),
  };
  if (missing.length > 0) {
    log(`WARNING: no Steam tag for ${missing.join(', ')} — those items cannot be priced`);
  }
  return tags;
}

/**
 * The snapshot to resume from, or null. The path is the caller's: the CLI resumes from `OUT`,
 * and a long-running caller resumes from wherever it keeps its own state.
 */
export function loadPrior(path, log = defaultLog) {
  if (!existsSync(path)) return null;
  try {
    // Normalised, not merely validated: the file on disk is whatever the last run published, and
    // a version 2 one carries no native quotes for the merge to reason about.
    const parsed = readMarketSnapshot(JSON.parse(readFileSync(path, 'utf-8')));
    if (parsed == null) {
      log(`ignoring ${path}: not a recognised snapshot`);
      return null;
    }
    log(`resuming from ${path} (${parsed.entries.length} entries, generated ${parsed.generatedUtc})`);
    return parsed;
  } catch (err) {
    log(`ignoring ${path}: ${err.message}`);
    return null;
  }
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const fetchAppFilters = (appId) => getJson(appFiltersUrl(appId));

async function fetchSearchPage(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, rateLimited: false };
  }
  // Steam answers an exhausted per-IP quota with 429, and sometimes with a 502/503 from the
  // edge once the block is in place; both mean back off rather than skip the partition.
  if (res.status === 429 || res.status === 502 || res.status === 503) {
    return { ok: false, rateLimited: true };
  }
  if (!res.ok) return { ok: false, rateLimited: false };
  try {
    return { ok: true, page: parseSearchPage(await res.json()) };
  } catch {
    return { ok: false, rateLimited: false };
  }
}

async function fetchPriceOverview(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, rateLimited: false };
  }
  if (res.status === 429 || res.status === 502 || res.status === 503) {
    return { ok: false, rateLimited: true };
  }
  if (!res.ok) return { ok: false, rateLimited: false };
  try {
    return { ok: true, quote: parsePriceOverview(await res.json()) };
  } catch {
    return { ok: false, rateLimited: false };
  }
}

async function fetchFx(prior, log = defaultLog) {
  try {
    const data = await getJson(FRANKFURTER_LATEST);
    const rates = { USD: 1, ...(data.rates ?? {}) };
    if (Object.keys(rates).length > 1) return { ok: true, rates };
    log('FX returned no rates; keeping the previous ones');
  } catch (err) {
    log(`FX fetch failed (${err.message}); keeping the previous ones`);
  }
  return { ok: false, rates: prior?.fx ?? { USD: 1 } };
}

export function summarise(snapshot) {
  const { coverage } = snapshot;
  const lines = [
    `market rows: ${coverage.marketRows}`,
    `classified: ${coverage.keyedRows} (${coverage.unkeyedRows} unexplained)`,
    `with a live listing: ${coverage.pricedRows}`,
    `catalog keys carried: ${coverage.matchedCatalogKeys}/${coverage.catalogKeys}`,
    `keys with a second hash: ${Object.keys(snapshot.alternates).length}`,
    `search calls: ${coverage.searchCalls}`,
    `anomalies: ${snapshot.anomalies.length}`,
  ];
  for (const line of lines) defaultLog(line);
  for (const anomaly of snapshot.anomalies.slice(0, 20)) {
    defaultLog(`  anomaly [${anomaly.kind}] ${anomaly.detail}`);
  }

  // An unmapped tag does not fail anything — it just makes every item behind it lose its price
  // silently. Raise it to a run annotation so it is visible without opening the log.
  //
  // Only Actions renders an annotation. Anywhere else it is a line nobody reads, so a caller off
  // CI is expected to surface the same rows itself — the sweep hands them back in its statistics.
  const unmapped = snapshot.anomalies.filter((anomaly) => anomaly.kind.startsWith('unknown-'));
  if (unmapped.length > 0 && process.env.GITHUB_ACTIONS === 'true') {
    const kinds = [...new Set(unmapped.map((anomaly) => anomaly.kind))].join(', ');
    console.log(
      `::warning title=Unmapped market tags::${unmapped.length} rows the catalog cannot explain (${kinds}). ` +
        `See packages/pricing/src/market/tags.ts and docs/market-prices.md.`,
    );
  }
  return lines;
}

/**
 * The two lines the quote pass and the discovery pass each emit, once, per 429. Neither pass
 * totals them — the quote pass resets its consecutive counter on every success — so a pass that
 * absorbed five and recovered reports itself complete with nothing to show for them. Reading the
 * count off the log is what makes those visible without changing two packages' return shapes.
 *
 * This couples a counter to log prose, which is fragile. The sweep's own guard drives a
 * rate-limited stub down each path and fails if either message is reworded.
 */
const RATE_LIMIT_LINE = /^rate limited on |^rate-limited at /;

function countingLog(inner) {
  let hits = 0;
  return {
    log: (message) => {
      if (RATE_LIMIT_LINE.test(message)) hits += 1;
      inner(message);
    },
    hits: () => hits,
  };
}

/**
 * The real network, as one bundle. Injectable so the sweep can be driven without touching Steam;
 * this is also the only handle through which anything else could reach it.
 */
const STEAM_NET = { fetchAppFilters, fetchSearchPage, fetchPriceOverview, fetchFx };

/**
 * Run one complete sweep: enumerate, tag, reconcile, quote the rotation, build the snapshot.
 * The only Steam-talking entry point in the repository. Returns the artifact and what a caller
 * needs to describe the pass without re-deriving it.
 *
 * Nothing here reads or writes disk state: `prior` is passed in and the snapshot is returned, so
 * the CLI and any longer-lived caller each keep their own resume path.
 */
export async function runSweep({
  appId = APP_ID,
  catalog = loadCatalog(),
  prior = null,
  searchDelayMs = DELAY_MS,
  quoteDelayMs = QUOTE_DELAY_MS,
  nativeCurrencies = NATIVE_CURRENCIES,
  log = defaultLog,
  now = Date.now,
  steamNet = STEAM_NET,
} = {}) {
  const startedAtMs = now();
  const rateLimits = countingLog(log);
  const sweepLog = rateLimits.log;

  const tags = steamTagsFor(catalog, sweepLog);
  sweepLog(`catalog: ${catalog.defs.length} defs x ${catalog.rarityIdxs.length} rarities`);

  const discovery = await discoverMarket(appId, {
    fetchAppFilters: () => steamNet.fetchAppFilters(appId),
    fetchSearchPage: steamNet.fetchSearchPage,
    catalogTags: tags,
    knownTags: knownTagsFrom(prior?.entries ?? []),
    sleep,
    baseDelayMs: searchDelayMs,
    log: sweepLog,
  });
  sweepLog(
    (discovery.facetSweepRan
      ? `tagged ${discovery.rows.length} rows in ${discovery.searchCalls} calls`
      : `carried the tags of ${discovery.rows.length} known rows over ` +
        `${discovery.searchCalls} calls`) +
      ` (${discovery.complete ? 'complete' : 'PARTIAL — rate limited'})`,
  );

  const generatedUtc = new Date(now()).toISOString();
  const reconciled = reconcile(discovery.rows, catalog, generatedUtc);

  // Only rows the enumeration found a listing for: an unlisted row has nothing to quote, and the
  // per-item call is the expensive half of the sweep.
  const quotable = reconciled.entries.filter((entry) => entry.lowestUsd != null);
  const quoted = await quoteNative(appId, quotable.map((entry) => entry.hashName), nativeCurrencies, {
    fetchPriceOverview: steamNet.fetchPriceOverview,
    sleep,
    baseDelayMs: quoteDelayMs,
    now,
    log: sweepLog,
  });
  sweepLog(
    `quoted ${quoted.quotes.size}/${quotable.length} rows in ${nativeCurrencies.join(', ')} ` +
      `over ${quoted.calls} calls (${quoted.unquoted} unquoted by Steam` +
      `${quoted.complete ? '' : ', PARTIAL — rate limited'})`,
  );

  const withQuotes = reconciled.entries.map((entry) => {
    const native = quoted.quotes.get(entry.hashName);
    if (native == null) return entry;
    const lowestNative = Object.fromEntries(
      Object.entries(native).map(([currency, quote]) => [currency, quote.lowest]),
    );
    return { ...entry, lowestNative, nativeQuotedUtc: quoted.quotedUtc };
  });

  const fx = await steamNet.fetchFx(prior, sweepLog);

  const snapshot = buildSnapshot({
    entries: withQuotes,
    prior,
    catalog,
    fx: fx.rates,
    nativeCurrencies,
    anomalies: [...discovery.anomalies, ...reconciled.anomalies, ...quoted.anomalies],
    searchCalls: discovery.searchCalls + quoted.calls,
    enumerationComplete: discovery.enumerationComplete,
    now,
    appId,
  });

  const quotesAttempted = quotable.length * nativeCurrencies.length;
  const unmappedTags = snapshot.anomalies.filter((anomaly) => anomaly.kind.startsWith('unknown-'));

  // Every attempt increments `calls` and only a rate limit retries, so the difference is exactly
  // the 429s the rotation absorbed — but only on a pass that finished. Once the breaker trips,
  // the items after it were never attempted and `quotesAttempted` overstates, so the derivation
  // is reported as absent rather than as a wrong number. It is also blind to the discovery pass.
  const rateLimitHits = rateLimits.hits();
  const rateLimitHitsDerived = quoted.complete ? quoted.calls - quotesAttempted : null;
  if (rateLimitHitsDerived !== null && rateLimitHitsDerived !== rateLimitHits) {
    sweepLog(
      `WARNING quote.rateLimitCountMismatch: counted ${rateLimitHits}, ` +
        `derived ${rateLimitHitsDerived} from the rotation alone; keeping the counted one`,
    );
  }

  const stats = {
    startedAtMs,
    finishedAtMs: now(),
    rowsSeen: discovery.rows.length,
    searchCalls: discovery.searchCalls,
    quoteCalls: quoted.calls,
    quotesAttempted,
    quotesOk: quoted.quotes.size,
    // The snapshot keeps only `lowest` per currency, so this is the sole route by which the
    // median and the 24h volume the rotation already paid for reach a caller at all.
    quotes: quoted.quotes,
    quotedUtc: quoted.quotedUtc,
    unquoted: quoted.unquoted,
    rateLimitHits,
    rateLimitHitsDerived,
    enumerationComplete: discovery.enumerationComplete,
    facetSweepRan: discovery.facetSweepRan,
    discoveryComplete: discovery.complete,
    quotesComplete: quoted.complete,
    fxOk: fx.ok,
    anomalies: snapshot.anomalies,
    unmappedTags,
    unlinkableItems: snapshot.anomalies.filter((anomaly) => anomaly.kind === 'unlinkable-item'),
  };

  return { snapshot, stats };
}

async function main() {
  const catalog = loadCatalog();
  const prior = loadPrior(OUT);
  const { snapshot, stats } = await runSweep({ catalog, prior });

  // The workflow publishes whatever is on disk whether or not this step succeeded, so refusing
  // to write is what keeps the last good snapshot in place — and exiting non-zero is the only
  // thing that says so out loud. A run that publishes a snapshot nobody can look a price up in is
  // otherwise indistinguishable from a good one: the job is green either way, and the first
  // report comes from a player watching an inventory board read zero.
  //
  // Gated on the tagging passes, not the enumeration: the enumeration is the cheap tenth of the
  // sweep and finishes even on a run the quota kills, which is exactly how a full row set can be
  // published with nothing identified in it.
  const lost = stats.discoveryComplete ? [] : catalogKeysLost(prior, snapshot, catalog);
  if (lost.length === 0) writeFileSync(OUT, JSON.stringify(snapshot));

  const lines = summarise(snapshot);
  if (lost.length > 0) {
    lines.push(`REFUSED TO PUBLISH: would lose ${lost.length} catalog keys the last snapshot had`);
    defaultLog(`refusing to publish: ${lost.length} keys lost, e.g. ${lost.slice(0, 5).join(', ')}`);
    console.log(
      `::error title=Market snapshot would lose coverage::A cut-short run cannot delist anything, ` +
        `so ${lost.length} catalog keys going missing is this run mis-deriving them. Kept the ` +
        `previous ${OUT}. See docs/market-prices.md.`,
    );
    process.exitCode = 1;
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Market snapshot\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`,
      { flag: 'a' },
    );
  }
}

// Only when this file IS the process entry point. Importing it for its loader — which a guard
// does, to prove the loader supplies what reconciliation needs — must not start a Steam sweep.
const invokedAsCli =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
