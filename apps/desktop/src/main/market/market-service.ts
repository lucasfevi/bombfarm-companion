import {
  MARKET_QUOTE_CURRENCY,
  emptyMarketSnapshotView,
  type MarketQuoteFailureReason,
  type MarketQuoteResult,
  type MarketQuoteTarget,
  type MarketSnapshotError,
  type MarketSnapshotView,
} from '@bombfarm/contracts';
import {
  MARKET_APP_ID,
  readMarketSnapshot,
  parsePriceOverview,
  priceOverviewUrl,
  type MarketEntry,
  type MarketSnapshot,
} from '@bombfarm/pricing';
import type { LogPort } from '../storage/index.js';
import {
  nodeMarketCacheIo,
  readMarketCache,
  writeMarketCache,
  type MarketCacheIo,
} from './market-cache.js';
import { MARKET_SNAPSHOT_URL, type MarketHttpGet } from './market-transport.js';

export type MarketView = MarketSnapshotView<MarketSnapshot>;

export interface MarketServiceDeps {
  httpGet: MarketHttpGet;
  cachePath: string;
  log: LogPort;
  now(): number;
  sleep(ms: number): Promise<void>;
  io?: MarketCacheIo;
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  snapshotRefreshMs?: number;
  /** Minimum spacing between two per-item quotes. 53 sequential calls at 3.5s drew zero 429s
   *  (measured 2026-08-29), so that is the floor a refresh is paced to. */
  quoteSpacingMs?: number;
  quoteBackoffMs?: number;
  maxQuoteBackoffMs?: number;
  onChanged?(view: MarketView): void;
}

export interface MarketService {
  start(): void;
  stop(): void;
  getView(): MarketView;
  refreshSnapshot(): Promise<MarketView>;
  refreshItem(target: MarketQuoteTarget): Promise<MarketQuoteResult>;
}

/**
 * How stale an idle desktop's prices are allowed to get. It does not track how often the snapshot
 * is published — that is far more often than a planner needs — and checking often is cheap,
 * because a check that finds nothing new is a conditional request answered 304, which adopts
 * nothing and announces nothing. Below the five-minute `max-age` the published file is served
 * with, a check could not see anything newer anyway; that is the floor, not this.
 */
const SNAPSHOT_REFRESH_MS = 15 * 60 * 1000;

interface QuoteSubject {
  readonly key: string | null;
  readonly hashName: string;
  readonly position: number | null;
  readonly keptAmount: number | null;
}

function nativeAmount(entry: MarketEntry | undefined): number | null {
  return entry?.lowestNative[MARKET_QUOTE_CURRENCY] ?? null;
}

export function createMarketService(deps: MarketServiceDeps): MarketService {
  const io = deps.io ?? nodeMarketCacheIo;
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const snapshotRefreshMs = deps.snapshotRefreshMs ?? SNAPSHOT_REFRESH_MS;
  const quoteSpacingMs = deps.quoteSpacingMs ?? 3_500;
  const baseBackoffMs = deps.quoteBackoffMs ?? 30_000;
  const maxBackoffMs = deps.maxQuoteBackoffMs ?? 15 * 60_000;

  let view: MarketView = emptyMarketSnapshotView<MarketSnapshot>();
  let etag: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;

  let queue: Promise<void> = Promise.resolve();
  let lastQuoteAt: number | null = null;
  let backoffMs = 0;
  let backoffUntil = 0;

  const iso = (): string => new Date(deps.now()).toISOString();

  function publish(): void {
    deps.onChanged?.(view);
  }

  function adopt(snapshot: MarketSnapshot, source: 'cache' | 'network', adoptedUtc: string, checkedUtc: string | null): void {
    view = {
      snapshot,
      source,
      publishedUtc: snapshot.generatedUtc,
      adoptedUtc,
      checkedUtc: checkedUtc ?? view.checkedUtc,
      lastError: null,
    };
  }

  /** A check that produced no new snapshot leaves whatever is already in hand exactly where it
   *  was — the cold-start cache included. Only the freshness fields move. */
  function noteCheckFailure(reason: MarketSnapshotError, checkedUtc: string): MarketView {
    view = { ...view, checkedUtc, lastError: reason };
    return view;
  }

  function persist(): void {
    if (view.snapshot === null || view.adoptedUtc === null) return;
    const written = writeMarketCache(io, deps.cachePath, {
      etag,
      adoptedUtc: view.adoptedUtc,
      snapshot: view.snapshot,
    });
    if (!written) deps.log.warn({ scope: 'market', event: 'cache.write_failed' });
  }

  function loadCache(): void {
    const record = readMarketCache(io, deps.cachePath);
    if (record === null) return;
    // Normalised, not merely validated: a snapshot cached before native quotes existed outlives
    // the rollout on disk, and its entries carry no `lowestNative` for pricing to read.
    const cached = readMarketSnapshot(record.snapshot);
    if (cached === null) {
      deps.log.warn({ scope: 'market', event: 'cache.malformed' });
      return;
    }
    etag = record.etag;
    adopt(cached, 'cache', record.adoptedUtc, null);
    deps.log.info({ scope: 'market', event: 'cache.loaded', publishedUtc: view.publishedUtc });
    publish();
  }

  async function refreshSnapshot(): Promise<MarketView> {
    const checkedUtc = iso();

    let response;
    try {
      response = await deps.httpGet({ url: MARKET_SNAPSHOT_URL, etag });
    } catch (error: unknown) {
      deps.log.warn({ scope: 'market', event: 'snapshot.fetch_failed', error: String(error) });
      return noteCheckFailure('network', checkedUtc);
    }

    if (response.status === 304) {
      view = { ...view, checkedUtc, lastError: null };
      deps.log.info({ scope: 'market', event: 'snapshot.unchanged' });
      return view;
    }

    if (response.status === 429) {
      deps.log.warn({ scope: 'market', event: 'snapshot.rate_limited' });
      return noteCheckFailure('rate-limited', checkedUtc);
    }

    if (response.status !== 200) {
      deps.log.warn({ scope: 'market', event: 'snapshot.rejected', status: response.status });
      return noteCheckFailure('network', checkedUtc);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      deps.log.warn({ scope: 'market', event: 'snapshot.unparseable' });
      return noteCheckFailure('malformed', checkedUtc);
    }

    const snapshot = readMarketSnapshot(parsed);
    if (snapshot === null) {
      deps.log.warn({ scope: 'market', event: 'snapshot.rejected_shape' });
      return noteCheckFailure('malformed', checkedUtc);
    }

    etag = response.etag;
    adopt(snapshot, 'network', checkedUtc, checkedUtc);
    persist();
    deps.log.info({ scope: 'market', event: 'snapshot.adopted', publishedUtc: view.publishedUtc });
    publish();
    return view;
  }

  function scheduleNext(): void {
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
    if (stopped) return;
    timer = setTimeoutFn(() => {
      void refreshSnapshot().finally(scheduleNext);
    }, snapshotRefreshMs);
  }

  function subjectFor(target: MarketQuoteTarget): QuoteSubject | null {
    const snapshot = view.snapshot;
    if (target.kind === 'key') {
      const position = snapshot?.index[target.key];
      const entry = position === undefined ? undefined : snapshot?.entries[position];
      if (entry === undefined || position === undefined) return null;
      return { key: target.key, hashName: entry.hashName, position, keptAmount: nativeAmount(entry) };
    }

    const position = snapshot?.entries.findIndex((entry) => entry.hashName === target.hashName) ?? -1;
    const entry = position < 0 ? undefined : snapshot?.entries[position];
    return {
      key: entry?.key ?? null,
      hashName: target.hashName,
      position: position < 0 ? null : position,
      keptAmount: nativeAmount(entry),
    };
  }

  function mergeQuote(position: number, amount: number, quotedUtc: string): void {
    const snapshot = view.snapshot;
    if (snapshot === null) return;
    const entry = snapshot.entries[position];
    if (entry === undefined) return;

    const entries = snapshot.entries.slice();
    entries[position] = {
      ...entry,
      lowestNative: { ...entry.lowestNative, [MARKET_QUOTE_CURRENCY]: amount },
      nativeQuotedUtc: quotedUtc,
    };
    view = { ...view, snapshot: { ...snapshot, entries } };
    persist();
  }

  function pacingDelayMs(): number {
    const now = deps.now();
    const sinceLast = lastQuoteAt === null ? Number.POSITIVE_INFINITY : now - lastQuoteAt;
    const spacing = sinceLast >= quoteSpacingMs ? 0 : quoteSpacingMs - sinceLast;
    return Math.max(spacing, backoffUntil - now, 0);
  }

  function widenBackoff(): void {
    backoffMs = backoffMs === 0 ? baseBackoffMs : Math.min(backoffMs * 2, maxBackoffMs);
    backoffUntil = deps.now() + backoffMs;
  }

  function clearBackoff(): void {
    backoffMs = 0;
    backoffUntil = 0;
  }

  function failure(
    subject: Pick<QuoteSubject, 'key' | 'keptAmount'> & { hashName: string | null },
    reason: MarketQuoteFailureReason,
  ): MarketQuoteResult {
    return {
      ok: false,
      key: subject.key,
      hashName: subject.hashName,
      reason,
      keptAmount: subject.keptAmount,
      at: iso(),
    };
  }

  /** The subject is resolved here rather than at call time: an earlier queued quote can adopt a
   *  snapshot or move a price while this one waits, and `keptAmount` has to be what the snapshot
   *  actually carries at the moment the refresh runs. */
  async function quote(target: MarketQuoteTarget): Promise<MarketQuoteResult> {
    const subject = subjectFor(target);
    if (subject === null) {
      return failure({ key: target.kind === 'key' ? target.key : null, hashName: null, keptAmount: null }, 'unknown-item');
    }

    const delay = pacingDelayMs();
    if (delay > 0) await deps.sleep(delay);
    lastQuoteAt = deps.now();

    let response;
    try {
      response = await deps.httpGet({
        url: priceOverviewUrl(MARKET_APP_ID, subject.hashName, MARKET_QUOTE_CURRENCY),
        etag: null,
      });
    } catch (error: unknown) {
      deps.log.warn({ scope: 'market', event: 'quote.failed', error: String(error) });
      return failure(subject, 'network');
    }

    if (response.status === 429) {
      widenBackoff();
      deps.log.warn({ scope: 'market', event: 'quote.rate_limited', backoffMs });
      return failure(subject, 'rate-limited');
    }

    clearBackoff();

    if (response.status !== 200) {
      deps.log.warn({ scope: 'market', event: 'quote.rejected', status: response.status });
      return failure(subject, 'network');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(response.body);
    } catch {
      return failure(subject, 'network');
    }

    const amount = parsePriceOverview(payload)?.lowest ?? null;
    // Steam declining to quote is not evidence the item is unlisted — it has answered with no
    // price for an item that had a live listing. The snapshot's own price stands.
    if (amount === null) {
      deps.log.info({ scope: 'market', event: 'quote.declined', hashName: subject.hashName });
      return failure(subject, 'not-quoted');
    }

    const quotedUtc = iso();
    if (subject.position !== null) {
      mergeQuote(subject.position, amount, quotedUtc);
      publish();
    }

    return {
      ok: true,
      key: subject.key,
      hashName: subject.hashName,
      currency: MARKET_QUOTE_CURRENCY,
      amount,
      quotedUtc,
    };
  }

  /** One call at a time, in arrival order — a burst of per-item refreshes must never become a
   *  burst of requests. */
  function enqueue(job: () => Promise<MarketQuoteResult>): Promise<MarketQuoteResult> {
    const result = queue.then(job, job);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      loadCache();
      void refreshSnapshot().finally(scheduleNext);
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
    },
    getView() {
      return view;
    },
    refreshSnapshot,
    refreshItem(target) {
      return enqueue(() => quote(target));
    },
  };
}
