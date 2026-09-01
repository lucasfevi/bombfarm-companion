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

export function createLogger({ write = console.log, clock = () => new Date() } = {}) {
  return (evt, fields = {}, lvl = 'info') => {
    write(JSON.stringify({ ts: clock().toISOString(), lvl, evt, ...fields }));
  };
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
