import { SEARCH_PAGE_SIZE, parseAppFilters, searchRenderUrl } from './endpoints.js';
import { EQUIPMENT_CATEGORY_TAG, STEAM_CATEGORY_TO_KIND, isKnownTag } from './tags.js';
import { FACET_NAMES } from './types.js';
import type {
  Anomaly,
  AnomalyKind,
  AppFilters,
  FacetName,
  SearchFilters,
  SearchPage,
  SearchRow,
} from './types.js';

export type SearchFetchResult =
  | { ok: true; page: SearchPage }
  | { ok: false; rateLimited: boolean };

export interface DiscoverDeps {
  fetchAppFilters: () => Promise<unknown>;
  fetchSearchPage: (url: string) => Promise<SearchFetchResult>;
  /**
   * Tags to fall back on when Steam's own facet listing leaves an equipment row untagged.
   * Measured 2026-08-28: `appfilters` omitted `slot=helmet` while a helmet was listed and
   * sellable, so it cannot be the only source of the tags to ask for.
   */
  catalogTags: Record<'set' | 'slot' | 'rarity', string[]>;
  /**
   * Facet tags a previous run established, by market hash. A sweep whose enumeration turns up
   * nothing outside this set asks no facet queries at all and stamps these instead.
   */
  knownTags?: Record<string, Partial<Record<FacetName, string>>>;
  sleep: (ms: number) => Promise<void>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Stop the whole sweep after this many consecutive rate limits — the IP quota is spent. */
  maxConsecutiveRateLimits?: number;
  log?: (message: string) => void;
}

/** One market row and the facet tags it is known to carry, because it was queried by them. */
export interface DiscoveryRow {
  row: SearchRow;
  tags: Partial<Record<FacetName, string>>;
}

export interface DiscoveryResult {
  filters: AppFilters;
  rows: DiscoveryRow[];
  /** True when the flat enumeration finished, making the row set authoritative. */
  enumerationComplete: boolean;
  /** False when every enumerated row was already known, so not one facet query was issued. */
  facetSweepRan: boolean;
  anomalies: Anomaly[];
  searchCalls: number;
  /** False when the circuit breaker tripped anywhere in the run. */
  complete: boolean;
}

const DEFAULT_BASE_DELAY_MS = 1500;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS = 6;

/**
 * Category first: it is what tells the completeness check which rows are equipment. Rarity next,
 * because it is both the cheapest pass — six tags against a set's forty — and the one every key
 * depends on: without it an equipment row falls back to being keyed by hash name, which no
 * inventory can look up. A quota that runs out partway should cost a facet, not the whole board.
 */
const FACET_ORDER: FacetName[] = ['category', 'rarity', 'slot', 'set', 'level', 'act'];

const UNKNOWN_TAG_ANOMALY: Partial<Record<FacetName, AnomalyKind>> = {
  slot: 'unknown-slot-tag',
  rarity: 'unknown-rarity-tag',
  category: 'unknown-category-tag',
};

class RateLimitedOut extends Error {}

/**
 * Enumerate the whole market, then tag what it found.
 *
 * The enumeration is a flat paged walk of `search/render` with no filters. That is the only way
 * to be sure nothing is missed: a facet-driven enumeration can only find items the catalog
 * already knows how to ask for, and the market carries things it does not — skins, hero cages,
 * item chests. It is also the cheaper half, ten rows a call for the entire app.
 *
 * Tagging is the second pass, because `search/render` returns no tags at all. Each facet-narrowed
 * query says, by construction, that every row it returns carries that tag — so a row's set, slot
 * and rarity are learned by asking, never by parsing `market_hash_name`. That matters here beyond
 * theory: the game renamed its items days after launch (`Ember Amulet (Rare)` became
 * `Ember Amulet Lv 10 (Rare)`), and a name parser would have broken on the rename while a facet
 * query did not notice it.
 *
 * That second pass runs only when the enumeration turns up a row `knownTags` cannot name. It is a
 * burst — sixty-odd queries seconds apart, against a rotation paced in tens of seconds — and item
 * identity is near-static, so paying it hourly to re-learn what has not changed is what spent an
 * address's quota. Paying it on the day an item is first listed is the intended cost; narrowing it
 * to the new row is not possible, since the sweep learns a tag by asking for it and reading back
 * which rows answer.
 */
export async function discoverMarket(appId: number, deps: DiscoverDeps): Promise<DiscoveryResult> {
  const baseDelayMs = deps.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = deps.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxConsecutiveRateLimits =
    deps.maxConsecutiveRateLimits ?? DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS;

  const anomalies: Anomaly[] = [];
  const byHash = new Map<string, DiscoveryRow>();
  let searchCalls = 0;
  let delayMs = baseDelayMs;
  // Consecutive across the whole run, not per query: the quota Steam enforces is on the IP.
  let consecutiveRateLimits = 0;
  let complete = true;
  let enumerationComplete = false;
  let facetSweepRan = false;

  // The facet schema is a hint, not a prerequisite. Letting a failed fetch throw would abandon
  // the run before a single price was written, which is what a 429 here used to do.
  let filters: AppFilters = {};
  try {
    filters = parseAppFilters(await deps.fetchAppFilters());
  } catch (err) {
    deps.log?.(`appfilters unavailable (${String(err)}); tagging from the catalog alone`);
  }

  const upsert = (row: SearchRow): DiscoveryRow => {
    const existing = byHash.get(row.hashName);
    if (existing != null) return existing;
    const fresh: DiscoveryRow = { row, tags: {} };
    byHash.set(row.hashName, fresh);
    return fresh;
  };

  const sweep = async (
    narrow: SearchFilters,
    onRow: (entry: DiscoveryRow) => void,
  ): Promise<boolean> => {
    let start = 0;
    let totalCount = Number.POSITIVE_INFINITY;

    while (start < totalCount) {
      const result = await deps.fetchSearchPage(searchRenderUrl(appId, narrow, start));
      searchCalls += 1;

      if (!result.ok) {
        if (!result.rateLimited) {
          deps.log?.(`search failed at ${describe(narrow)} start=${String(start)}; moving on`);
          return false;
        }
        consecutiveRateLimits += 1;
        if (consecutiveRateLimits >= maxConsecutiveRateLimits) {
          anomalies.push({
            kind: 'rate-limited',
            detail: `quota spent after ${String(searchCalls)} search calls at ${describe(narrow)}`,
          });
          throw new RateLimitedOut();
        }
        delayMs = Math.min(delayMs * 2, maxDelayMs);
        deps.log?.(
          `rate-limited at ${describe(narrow)}; backing off ${String(Math.round(delayMs / 1000))}s ` +
            `(${String(consecutiveRateLimits)}/${String(maxConsecutiveRateLimits)})`,
        );
        await deps.sleep(delayMs);
        continue;
      }

      consecutiveRateLimits = 0;
      delayMs = baseDelayMs;
      totalCount = result.page.totalCount;
      for (const row of result.page.rows) onRow(upsert(row));

      if (result.page.rows.length === 0) break;
      start += SEARCH_PAGE_SIZE;
      await deps.sleep(delayMs);
    }
    return true;
  };

  /** Narrow by one tag and stamp it on every row that comes back. */
  const tagPass = async (facet: FacetName, tag: string): Promise<boolean> =>
    sweep({ [facet]: tag }, (entry) => {
      const claimed = entry.tags[facet];
      if (claimed != null && claimed !== tag) {
        anomalies.push({
          kind: 'ambiguous-tag',
          detail: `${entry.row.hashName} is tagged ${facet}=${claimed} and ${facet}=${tag}`,
        });
        return;
      }
      entry.tags[facet] = tag;
    });

  /** Ask for every tag there is, and let the rows that answer say what they are. */
  const tagEveryRow = async (): Promise<void> => {
    const attempted: Record<string, Set<string>> = {};
    for (const facet of FACET_ORDER) {
      attempted[facet] = new Set<string>();
      const tags = candidateTags(facet, filters);
      for (const tag of tags) {
        attempted[facet].add(tag);
        await tagPass(facet, tag);
      }
    }

    // Steam's facet listing under-reports, so verify rather than trust: every equipment row must
    // have come back from a set, slot and rarity query. Anything still bare gets the catalog's
    // tags tried against it before the run gives up on pricing it.
    for (const facet of ['slot', 'set', 'rarity'] as const) {
      if (!missingFacet(byHash, facet)) continue;
      const untried = deps.catalogTags[facet].filter((tag) => !attempted[facet]?.has(tag));
      if (untried.length === 0) continue;
      deps.log?.(
        `${String(untried.length)} ${facet} tags Steam did not list; trying them for the rows ` +
          `still missing one`,
      );
      for (const tag of untried) {
        attempted[facet]?.add(tag);
        await tagPass(facet, tag);
        if (!missingFacet(byHash, facet)) break;
      }
    }

    for (const facet of ['slot', 'set', 'rarity'] as const) {
      for (const entry of byHash.values()) {
        if (!isEquipment(entry) || entry.tags[facet] != null) continue;
        anomalies.push({
          kind: 'untagged-equipment',
          detail: `${entry.row.hashName} matched no ${facet} query, so it cannot be priced`,
        });
      }
    }
  };

  try {
    enumerationComplete = await sweep({}, () => {
      // The flat pass exists to enumerate and price; tags arrive in the passes below.
    });
    deps.log?.(
      `enumerated ${String(byHash.size)} rows in ${String(searchCalls)} calls` +
        (enumerationComplete ? '' : ' (INCOMPLETE)'),
    );

    anomalies.push(...unknownTagsIn(filters));

    const knownTags = deps.knownTags ?? {};
    const newHashes = [...byHash.keys()].filter((hashName) => knownTags[hashName] == null);
    facetSweepRan = newHashes.length > 0;

    if (facetSweepRan) {
      deps.log?.(
        `${String(newHashes.length)} of ${String(byHash.size)} rows are new, e.g. ` +
          `${newHashes[0] ?? ''}; asking what everything is`,
      );
      await tagEveryRow();
    } else {
      for (const [hashName, entry] of byHash) entry.tags = { ...knownTags[hashName] };
      deps.log?.(`all ${String(byHash.size)} rows are already identified; asked no facet queries`);
    }
  } catch (err) {
    if (!(err instanceof RateLimitedOut)) throw err;
    complete = false;
    deps.log?.('circuit breaker tripped; returning partial discovery');
  }

  return {
    filters,
    rows: [...byHash.values()],
    enumerationComplete,
    facetSweepRan,
    anomalies,
    searchCalls,
    complete,
  };
}

const isEquipment = (entry: DiscoveryRow): boolean =>
  entry.tags.category === EQUIPMENT_CATEGORY_TAG;

/** True when some equipment row still has no value for `facet`. */
function missingFacet(rows: Map<string, DiscoveryRow>, facet: FacetName): boolean {
  for (const entry of rows.values()) {
    if (isEquipment(entry) && entry.tags[facet] == null) return true;
  }
  return false;
}

/**
 * The tags to ask for. Steam's listing goes first because it is the only source for facets the
 * catalog knows nothing about — `act`, `level`, and categories like `skin` that arrived after
 * launch. `category` additionally always includes the ones already mapped, so a category that
 * drops out of the listing does not take its items' prices with it.
 */
function candidateTags(facet: FacetName, filters: AppFilters): string[] {
  const published = filters[facet] ?? [];
  if (facet !== 'category') return published;
  return [...new Set([...published, ...Object.keys(STEAM_CATEGORY_TO_KIND)])];
}

/**
 * Tags Steam is publishing that the mapping tables do not know — the early warning that the game
 * has added a slot, rarity or category. `skin` arriving three days after launch is exactly this.
 */
function unknownTagsIn(filters: AppFilters): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (const facet of FACET_NAMES) {
    const kind = UNKNOWN_TAG_ANOMALY[facet];
    if (kind == null) continue;
    for (const tag of filters[facet] ?? []) {
      if (isKnownTag(facet, tag)) continue;
      anomalies.push({
        kind,
        detail: `appfilters publishes ${facet} tag "${tag}", which maps to nothing`,
      });
    }
  }
  return anomalies;
}

function describe(narrow: SearchFilters): string {
  const parts = Object.entries(narrow).map(([facet, tag]) => `${facet}=${String(tag)}`);
  return parts.length > 0 ? parts.join(',') : 'all';
}
