/**
 * The long-running collector: it repeats the market sweep on a cadence derived from a daily call
 * budget, persists what each pass read, publishes the artifact, and records the pass.
 *
 * It makes no market call of its own. The sweep it drives is the only thing in this repository
 * that talks to the market, and it is imported lazily so that everything here stays drivable
 * without a built workspace. This file's own requests reach the history store and the publishing
 * API and nothing else.
 */
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const MS_PER_DAY = 86_400_000;

/**
 * The rotation delay a full pass was measured drawing zero rate limits at. Never go below it
 * whatever the budget says: the budget bounds the daily total, not the instantaneous rate.
 */
export const MIN_SPACING_MS = 3_500;

const DEFAULT_DAILY_BUDGET = 2_000;

/**
 * Derive the rotation delay from a daily call budget. Raising the budget shortens the delay with
 * no code change; a budget high enough to breach the measured-safe floor is clamped rather than
 * obeyed, and says so, so a budget that is not being honoured is visible from the log.
 */
export function deriveSpacing(rawBudget) {
  const budget = Number(rawBudget);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(
      `MARKET_DAILY_BUDGET must be a positive number; got ${JSON.stringify(rawBudget)}`,
    );
  }
  const derived = Math.floor(MS_PER_DAY / budget);
  return {
    budget,
    spacingMs: Math.max(MIN_SPACING_MS, derived),
    spacingClamped: derived < MIN_SPACING_MS,
  };
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

export function readConfig(env) {
  const { budget, spacingMs, spacingClamped } = deriveSpacing(
    env.MARKET_DAILY_BUDGET ?? DEFAULT_DAILY_BUDGET,
  );
  const snapshotPath = env.SNAPSHOT ?? 'market-prices.json';
  return {
    supabaseUrl: required(env, 'SUPABASE_URL').replace(/\/+$/, ''),
    supabaseKey: required(env, 'SUPABASE_KEY'),
    githubToken: required(env, 'GITHUB_TOKEN'),
    repo: required(env, 'GITHUB_REPO'),
    budget,
    spacingMs,
    spacingClamped,
    currencies: (env.MARKET_CURRENCY ?? 'BRL')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
    releaseTag: env.RELEASE_TAG ?? 'market-prices',
    dataBranch: env.DATA_BRANCH ?? 'market-data',
    snapshotPath,
    // One variable names the resume file, and the published artifact takes its name, so the two
    // can never drift into disagreeing about which file the snapshot is.
    snapshotName: basename(snapshotPath),
  };
}

/**
 * One JSON object per line to stdout, for the service manager to capture. `evt` is a dotted
 * `subject.outcome` throughout so a filter on one subject reads as one thing.
 */
export function createLogger({ write = console.log, clock = () => new Date() } = {}) {
  return (evt, fields = {}, lvl = 'info') => {
    write(JSON.stringify({ ts: clock().toISOString(), lvl, evt, ...fields }));
  };
}

/**
 * Say what the pass saw. The two warnings are most of what replaces the annotation the sweep only
 * emits under CI: without them a newly unlinkable item would surface nowhere at all.
 */
export function logSweepStats(log, stats) {
  log('enumerate.done', {
    rows: stats.rowsSeen,
    calls: stats.searchCalls,
    complete: stats.enumerationComplete,
  });
  log('quote.done', {
    quoted: stats.quotesOk,
    calls: stats.quoteCalls,
    rateLimitHits: stats.rateLimitHits,
    complete: stats.quotesComplete,
  });

  if (!stats.quotesComplete) {
    log('quote.circuitBroken', { calls: stats.quoteCalls, quoted: stats.quotesOk }, 'error');
  }
  if (stats.rateLimitHitsDerived != null && stats.rateLimitHitsDerived !== stats.rateLimitHits) {
    log(
      'quote.rateLimitCountMismatch',
      { counted: stats.rateLimitHits, derived: stats.rateLimitHitsDerived },
      'warn',
    );
  }
  if (stats.unmappedTags.length > 0) {
    log(
      'tags.unmapped',
      {
        count: stats.unmappedTags.length,
        kinds: [...new Set(stats.unmappedTags.map((anomaly) => anomaly.kind))],
        details: stats.unmappedTags.map((anomaly) => anomaly.detail),
      },
      'warn',
    );
  }
  if (stats.unlinkableItems.length > 0) {
    log(
      'items.unlinkable',
      {
        count: stats.unlinkableItems.length,
        details: stats.unlinkableItems.map((anomaly) => anomaly.detail),
      },
      'warn',
    );
  }
}

/**
 * One row per (item, currency) the pass actually quoted. An item the market answered without a
 * price contributes no row: "unquoted" and "quoted as unlisted" are different claims, and a null
 * row would erase the difference in the history forever.
 */
export function quoteRowsFrom(stats) {
  const rows = [];
  for (const [hashName, byCurrency] of stats.quotes) {
    for (const [currency, quote] of Object.entries(byCurrency)) {
      rows.push({
        hash_name: hashName,
        currency,
        quoted_at: stats.quotedUtc,
        lowest: quote.lowest,
        median: quote.median,
        volume: quote.volume,
      });
    }
  }
  return rows;
}

/**
 * Identity for every row the pass saw. `first_seen` is deliberately absent: the upsert writes
 * only the columns the body carries, so omitting it lets the column default fire on insert and
 * leaves it untouched on update. Including it would reset every item's first-seen date every pass.
 */
export function itemRowsFrom(snapshot, lastSeen) {
  return snapshot.entries.map((entry) => ({
    hash_name: entry.hashName,
    key: entry.key,
    def_id: entry.defId,
    kind: entry.kind,
    category: entry.category,
    last_seen: lastSeen,
  }));
}

const HISTORY_TIMEOUT_MS = 30_000;

export function createHistory({ url, key, fetch, log, now = Date.now }) {
  const post = async (path, rows, prefer) => {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`${path} answered ${String(response.status)}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
  };

  /**
   * Never throws. A history failure must not cost the pass its publish — the artifact is what
   * users read — so it is reported to the caller and recorded on the run row instead.
   */
  const persistHistory = async (snapshot, stats) => {
    const startedMs = now();
    const quoteRows = quoteRowsFrom(stats);
    const itemRows = itemRowsFrom(snapshot, new Date(now()).toISOString());
    try {
      if (quoteRows.length > 0) await post('quote', quoteRows, 'return=minimal');
      if (itemRows.length > 0) {
        await post(
          'market_item?on_conflict=hash_name',
          itemRows,
          'resolution=merge-duplicates,return=minimal',
        );
      }
      log('history.done', {
        quoteRows: quoteRows.length,
        itemRows: itemRows.length,
        ms: now() - startedMs,
      });
      return { ok: true, error: null };
    } catch (err) {
      const error = String(err?.message ?? err);
      log('history.failed', { status: err?.status ?? null, body: err?.body ?? error }, 'error');
      return { ok: false, error };
    }
  };

  /** Never throws: it is called from a `finally`, where an exception would replace the real one. */
  const writeRun = async (row) => {
    try {
      await post('collector_run', [row], 'return=minimal');
    } catch (err) {
      log('run.failed', { status: err?.status ?? null, body: err?.body ?? String(err) }, 'error');
    }
  };

  return { persistHistory, writeRun };
}

async function main() {
  const config = readConfig(process.env);
  const log = createLogger();

  log('collector.start', {
    budget: config.budget,
    spacingMs: config.spacingMs,
    spacingClamped: config.spacingClamped,
    currencies: config.currencies,
    snapshotPath: config.snapshotPath,
  });
}

const invokedAsCli =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
