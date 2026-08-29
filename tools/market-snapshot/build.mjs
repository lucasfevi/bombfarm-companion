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
import { fileURLToPath } from 'node:url';
import {
  MARKET_APP_ID,
  appFiltersUrl,
  buildSnapshot,
  discoverMarket,
  isMarketSnapshot,
  parseSearchPage,
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
const FRANKFURTER_LATEST = 'https://api.frankfurter.app/latest?from=USD';
const USER_AGENT = 'Bomb Farm Companion market snapshot (+https://github.com/lucasfevi/bombfarm-companion)';

const OUT = process.env.OUT ?? 'market-prices.json';
const APP_ID = process.env.APP_ID ? Number(process.env.APP_ID) : MARKET_APP_ID;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[market-snapshot] ${message}`);

function loadCatalog() {
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
    sets: raw.sets,
    slots: raw.slots,
  };
}

/**
 * Fallback tags for the tagging passes, from the catalog rather than from `appfilters`, which was
 * measured omitting a slot that had a live listing.
 */
function steamTagsFor(catalog) {
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

function loadPrior() {
  if (!existsSync(OUT)) return null;
  try {
    const parsed = JSON.parse(readFileSync(OUT, 'utf-8'));
    if (!isMarketSnapshot(parsed)) {
      log(`ignoring ${OUT}: not a recognised snapshot`);
      return null;
    }
    log(`resuming from ${OUT} (${parsed.entries.length} entries, generated ${parsed.generatedUtc})`);
    return parsed;
  } catch (err) {
    log(`ignoring ${OUT}: ${err.message}`);
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

async function fetchFx(prior) {
  try {
    const data = await getJson(FRANKFURTER_LATEST);
    const rates = { USD: 1, ...(data.rates ?? {}) };
    if (Object.keys(rates).length > 1) return rates;
    log('FX returned no rates; keeping the previous ones');
  } catch (err) {
    log(`FX fetch failed (${err.message}); keeping the previous ones`);
  }
  return prior?.fx ?? { USD: 1 };
}

function summarise(snapshot) {
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
  for (const line of lines) log(line);
  for (const anomaly of snapshot.anomalies.slice(0, 20)) {
    log(`  anomaly [${anomaly.kind}] ${anomaly.detail}`);
  }

  // An unmapped tag does not fail anything — it just makes every item behind it lose its price
  // silently. Raise it to a run annotation so it is visible without opening the log.
  const unmapped = snapshot.anomalies.filter((anomaly) => anomaly.kind.startsWith('unknown-'));
  if (unmapped.length > 0) {
    const kinds = [...new Set(unmapped.map((anomaly) => anomaly.kind))].join(', ');
    console.log(
      `::warning title=Unmapped market tags::${unmapped.length} rows the catalog cannot explain (${kinds}). ` +
        `See packages/pricing/src/market/tags.ts and docs/market-prices.md.`,
    );
  }
  return lines;
}

async function main() {
  const catalog = loadCatalog();
  const tags = steamTagsFor(catalog);
  const prior = loadPrior();
  log(`catalog: ${catalog.defs.length} defs x ${catalog.rarityIdxs.length} rarities`);

  const discovery = await discoverMarket(APP_ID, {
    fetchAppFilters: () => getJson(appFiltersUrl(APP_ID)),
    fetchSearchPage,
    catalogTags: tags,
    sleep,
    baseDelayMs: DELAY_MS,
    log,
  });
  log(
    `tagged ${discovery.rows.length} rows in ${discovery.searchCalls} calls ` +
      `(${discovery.complete ? 'complete' : 'PARTIAL — rate limited'})`,
  );

  const generatedUtc = new Date().toISOString();
  const reconciled = reconcile(discovery.rows, catalog, generatedUtc);
  const snapshot = buildSnapshot({
    entries: reconciled.entries,
    prior,
    catalog,
    fx: await fetchFx(prior),
    anomalies: [...discovery.anomalies, ...reconciled.anomalies],
    searchCalls: discovery.searchCalls,
    enumerationComplete: discovery.enumerationComplete,
    now: Date.now,
    appId: APP_ID,
  });

  writeFileSync(OUT, JSON.stringify(snapshot));
  const lines = summarise(snapshot);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Market snapshot\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`,
      { flag: 'a' },
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
