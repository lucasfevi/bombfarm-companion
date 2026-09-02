#!/usr/bin/env node
/**
 * Fails when the published market snapshot has stopped advancing, or has advanced into a state
 * nothing can price from. One GET of a public file, no Steam call, no install, no write.
 *
 * The useless-but-fresh case is the one with a precedent: a partial sweep once published valid,
 * current JSON in which `matchedCatalogKeys` was 0, so no owned item could look up a price.
 * Freshness alone would have called that healthy.
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Raised here and nowhere else, so a cadence change costs one edit. */
export const MAX_AGE_HOURS = 6;

/** The file both shipped clients read; a monitor pointed anywhere else proves nothing. */
export const SNAPSHOT_URL =
  'https://raw.githubusercontent.com/lucasfevi/bombfarm-companion/market-data/market-prices.json';

const MS_PER_HOUR = 3_600_000;

function ageInHours(generatedUtc, nowMs) {
  if (typeof generatedUtc !== 'string') return null;
  const generatedMs = Date.parse(generatedUtc);
  if (Number.isNaN(generatedMs)) return null;
  return (nowMs - generatedMs) / MS_PER_HOUR;
}

export function evaluateSnapshot({ status, body, nowMs }) {
  if (status !== 200) {
    return { ok: false, failures: [`the published snapshot could not be fetched: HTTP ${status}`] };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(body);
  } catch {
    return { ok: false, failures: ['the published snapshot is not valid JSON'] };
  }

  const failures = [];

  const ageHours = ageInHours(snapshot?.generatedUtc, nowMs);
  if (ageHours === null) {
    failures.push('the published snapshot carries no readable generatedUtc');
  } else if (ageHours > MAX_AGE_HOURS) {
    failures.push(
      `the published snapshot has not advanced in ${ageHours.toFixed(1)} hours (threshold ${MAX_AGE_HOURS})`,
    );
  }

  const entries = snapshot?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push('the published snapshot carries no entries');
  }

  const matchedCatalogKeys = snapshot?.coverage?.matchedCatalogKeys;
  if (typeof matchedCatalogKeys !== 'number' || matchedCatalogKeys <= 0) {
    failures.push(
      'the published snapshot matches no catalog key, so nothing owned can be priced from it',
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    ageHours,
    entryCount: Array.isArray(entries) ? entries.length : 0,
    matchedCatalogKeys: typeof matchedCatalogKeys === 'number' ? matchedCatalogKeys : 0,
  };
}

export async function checkPublishedSnapshot({
  fetchImpl = fetch,
  now = Date.now,
  url = SNAPSHOT_URL,
} = {}) {
  let status;
  let body;
  try {
    const response = await fetchImpl(url, { headers: { 'cache-control': 'no-cache' } });
    status = response.status;
    body = await response.text();
  } catch (error) {
    return {
      ok: false,
      failures: [`the published snapshot could not be fetched: ${String(error?.message ?? error)}`],
    };
  }
  return evaluateSnapshot({ status, body, nowMs: now() });
}

export function renderSummary(result) {
  if (!result.ok) return result.failures.join('\n');
  return [
    `the published snapshot advanced ${result.ageHours.toFixed(1)} hours ago`,
    `${result.entryCount} entries, ${result.matchedCatalogKeys} catalog keys matched`,
  ].join('\n');
}

async function main() {
  const result = await checkPublishedSnapshot();
  const summary = renderSummary(result);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    writeFileSync(summaryPath, `${summary}\n`, { flag: 'a' });
  }
  process.stdout.write(`${summary}\n`);

  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
