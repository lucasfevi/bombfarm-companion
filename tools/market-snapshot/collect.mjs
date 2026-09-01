/**
 * The long-running collector: it repeats the market sweep on a cadence derived from a daily call
 * budget, persists what each pass read, publishes the artifact, and records the pass.
 *
 * It makes no market call of its own. The sweep it drives is the only thing in this repository
 * that talks to the market, and it is imported lazily so that everything here stays drivable
 * without a built workspace. This file's own requests reach the history store and the publishing
 * API and nothing else.
 */
import { writeFileSync } from 'node:fs';
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

/** The first name is canonical; the rest are accepted so a differently-named environment starts. */
const firstSet = (env, names) => {
  for (const name of names) {
    const value = env[name];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
};

/**
 * Every problem at once, never the first one only. This process is restarted on failure, so a
 * config error reported one variable at a time costs a restart cycle per variable to discover.
 */
export function readConfig(env) {
  const problems = [];

  const need = (...names) => {
    const value = firstSet(env, names);
    if (value == null) problems.push(`${names[0]} is not set`);
    return value;
  };

  const supabaseUrl = need('SUPABASE_URL');
  const supabaseKey = need('SUPABASE_KEY');
  const githubToken = need('GITHUB_TOKEN');
  const repo = need('GITHUB_REPO', 'GITHUB_REPOSITORY');

  let spacing = null;
  try {
    spacing = deriveSpacing(env.MARKET_DAILY_BUDGET ?? DEFAULT_DAILY_BUDGET);
  } catch (err) {
    problems.push(String(err.message));
  }

  if (problems.length > 0) {
    throw new Error(`the collector cannot start: ${problems.join('; ')}`);
  }

  const snapshotPath = firstSet(env, ['SNAPSHOT', 'MARKET_SNAPSHOT_PATH']) ?? 'market-prices.json';
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    supabaseKey,
    githubToken,
    repo,
    budget: spacing.budget,
    spacingMs: spacing.spacingMs,
    spacingClamped: spacing.spacingClamped,
    currencies: (env.MARKET_CURRENCY ?? 'BRL')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
    releaseTag: firstSet(env, ['RELEASE_TAG', 'MARKET_RELEASE_TAG']) ?? 'market-prices',
    dataBranch: firstSet(env, ['DATA_BRANCH', 'MARKET_DATA_BRANCH']) ?? 'market-data',
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
      // Prefixed because this shares the run row's `error` column with a pass that threw, and
      // health counts any non-null `error` as a failure. Both readings are genuinely lost, so
      // both belong in the count; the prefix is what separates a lost reading from a lost pass.
      const error = `history: ${String(err?.message ?? err)}`;
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

const GITHUB_API = 'https://api.github.com';
const GITHUB_UPLOADS = 'https://uploads.github.com';

/**
 * The two publish targets fail independently and are recorded independently: the desktop app and
 * the web planner read different ones, so "the snapshot published" is not a single fact.
 */
export function createPublisher({
  token,
  repo,
  releaseTag,
  dataBranch,
  snapshotName,
  fetch,
  log,
  now = Date.now,
}) {
  const headers = (extra = {}) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bombfarm-companion-market-collector',
    ...extra,
  });

  const call = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`${init?.method ?? 'GET'} ${url} answered ${String(response.status)}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return response;
  };

  const json = async (url, init) => (await call(url, init)).json();

  const post = (path, payload) =>
    json(`${GITHUB_API}/repos/${repo}/${path}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });

  const timed = async (target, bytes, publish) => {
    const startedMs = now();
    try {
      await publish();
      log('publish.done', { target, bytes, ms: now() - startedMs });
      return true;
    } catch (err) {
      log(
        'publish.failed',
        { target, status: err?.status ?? null, body: err?.body ?? String(err) },
        'error',
      );
      return false;
    }
  };

  const uploadAsset = (releaseId, body) =>
    call(
      `${GITHUB_UPLOADS}/repos/${repo}/releases/${String(releaseId)}/assets?name=${encodeURIComponent(snapshotName)}`,
      { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body },
    );

  /**
   * Delete-then-upload, because the REST API has no replace. That leaves a sub-second window
   * where the asset is missing — clients treat a failed download as "keep the cached snapshot" —
   * and it is why the upload gets a second attempt before the pass calls the target failed.
   */
  const publishRelease = (body) =>
    timed('release', body.length, async () => {
      const release = await json(`${GITHUB_API}/repos/${repo}/releases/tags/${releaseTag}`, {
        headers: headers(),
      });
      const existing = (release.assets ?? []).find((asset) => asset.name === snapshotName);
      if (existing) {
        await call(`${GITHUB_API}/repos/${repo}/releases/assets/${String(existing.id)}`, {
          method: 'DELETE',
          headers: headers(),
        });
      }
      try {
        await uploadAsset(release.id, body);
      } catch {
        await uploadAsset(release.id, body);
      }
    });

  /**
   * A fresh orphan commit, force-pushed. `parents: []` is what keeps the branch a single commit
   * forever: it is derived data with no value in its history, and a commit a pass would bloat
   * every clone of the repository.
   */
  const publishBranch = (body) =>
    timed('branch', body.length, async () => {
      const blob = await post('git/blobs', {
        content: Buffer.from(body, 'utf-8').toString('base64'),
        encoding: 'base64',
      });
      const tree = await post('git/trees', {
        tree: [{ path: snapshotName, mode: '100644', type: 'blob', sha: blob.sha }],
      });
      const commit = await post('git/commits', {
        message: `chore(market): snapshot ${new Date(now()).toISOString()}`,
        tree: tree.sha,
        parents: [],
      });
      await call(`${GITHUB_API}/repos/${repo}/git/refs/heads/${dataBranch}`, {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
    });

  return { publishRelease, publishBranch };
}

/**
 * The published snapshot is served with a five-minute max-age, so a pass that finished faster
 * than this gains nothing by publishing again immediately.
 */
export const MIN_PASS_MS = 300_000;

/**
 * A tripped breaker means the per-address quota is spent, and looping straight back into it is
 * how a temporary block becomes a permanent one.
 */
export const COOL_DOWN_LADDER_MS = [0, 15, 30, 60, 120].map((minutes) => minutes * 60_000);

export function nextCoolDown(currentMs) {
  const rung = COOL_DOWN_LADDER_MS.indexOf(currentMs);
  return COOL_DOWN_LADDER_MS[Math.min(rung + 1, COOL_DOWN_LADDER_MS.length - 1)];
}

export function runRowFrom(stats, snapshotBytes) {
  return {
    rows_seen: stats.rowsSeen,
    search_calls: stats.searchCalls,
    quote_calls: stats.quoteCalls,
    quotes_ok: stats.quotesOk,
    rate_limit_hits: stats.rateLimitHits,
    enumeration_complete: stats.enumerationComplete,
    quotes_complete: stats.quotesComplete,
    snapshot_bytes: snapshotBytes,
    anomalies: stats.anomalies.length,
    unmapped_tags: stats.unmappedTags.length,
    unlinkable_items: stats.unlinkableItems.length,
  };
}

/**
 * The pass, repeated. Three orderings here are load-bearing:
 *
 * History is written before publishing, because a reading not taken is gone forever while a
 * published snapshot can be rebuilt by the next pass — so a history failure is recorded and the
 * pass publishes anyway, the artifact being what users read.
 *
 * The run row is written in a `finally`, so a pass that throws still leaves a row carrying its
 * error. Health in one query would otherwise under-count failures as passes that never happened.
 *
 * A pass that completes with the rotation cut short is not an error — it publishes and persists
 * what it got — but it still enters the cool-down ladder, because a tripped breaker is the exact
 * signal the ladder exists for.
 */
export async function runCollector({
  config,
  runSweep,
  loadPrior,
  writeSnapshot,
  persistHistory,
  publishRelease,
  publishBranch,
  writeRun,
  log,
  sleep,
  now = Date.now,
  maxPasses = Infinity,
}) {
  let coolDownMs = 0;

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const startedAtMs = now();
    let row = {
      pass,
      started_at: new Date(startedAtMs).toISOString(),
      spacing_ms: config.spacingMs,
    };

    try {
      log('pass.start', { pass, spacingMs: config.spacingMs });

      const prior = loadPrior(config.snapshotPath);
      const { snapshot, stats } = await runSweep({
        prior,
        quoteDelayMs: config.spacingMs,
        nativeCurrencies: config.currencies,
        log: (message) => {
          log('sweep.line', { message });
        },
      });
      logSweepStats(log, stats);

      const body = JSON.stringify(snapshot);
      writeSnapshot(config.snapshotPath, body);
      row = { ...row, ...runRowFrom(stats, body.length) };

      const history = await persistHistory(snapshot, stats);
      if (!history.ok) row.error = history.error;

      row.published_release = await publishRelease(body);
      row.published_branch = await publishBranch(body);

      coolDownMs = stats.quotesComplete ? 0 : nextCoolDown(coolDownMs);
    } catch (err) {
      row.error = String(err?.stack ?? err);
      log('pass.failed', { pass, error: row.error }, 'error');
      coolDownMs = nextCoolDown(coolDownMs);
    } finally {
      row.finished_at = new Date(now()).toISOString();
      await writeRun(row);
      log('pass.done', { pass, ms: now() - startedAtMs, coolDownMs });
    }

    await sleep(Math.max(coolDownMs, MIN_PASS_MS - (now() - startedAtMs)));
  }
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

  // Imported here, not at module load: the sweep resolves a workspace package from its build
  // output, and everything above must stay drivable without one.
  const { runSweep, loadPrior } = await import('./build.mjs');
  const { persistHistory, writeRun } = createHistory({
    url: config.supabaseUrl,
    key: config.supabaseKey,
    fetch,
    log,
  });
  const { publishRelease, publishBranch } = createPublisher({
    token: config.githubToken,
    repo: config.repo,
    releaseTag: config.releaseTag,
    dataBranch: config.dataBranch,
    snapshotName: config.snapshotName,
    fetch,
    log,
  });

  await runCollector({
    config,
    runSweep,
    loadPrior,
    writeSnapshot: (path, body) => {
      writeFileSync(path, body);
    },
    persistHistory,
    publishRelease,
    publishBranch,
    writeRun,
    log,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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
