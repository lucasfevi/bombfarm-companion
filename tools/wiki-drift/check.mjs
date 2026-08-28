#!/usr/bin/env node
// The CLI entry point. Wires the four pure modules together, owns the exit code and the
// run summary, and is the only place `--write` is honoured.
//
// Stage order is fixed and cannot be reordered without breaking a test: (1) read + validate the
// baseline — before any request is made; (2) fetch both endpoints, bounded retry, per-request
// timeout; (3) parse + top-level type check (inside fetchEndpoints already); (4) fingerprint +
// compare. A fetch failure is therefore structurally incapable of becoming a drift claim — stage
// 4 is unreachable unless stage 2 already succeeded.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compareFingerprints, fingerprintPayload, readBaseline, serializeBaseline } from './fingerprint.mjs';
import { DATA_URL, FASES_NOMES_URL, fetchEndpoints } from './fetch-endpoints.mjs';
import { renderIssueBody, renderIssueTitle, renderSummary, TRACKER_MARKER } from './report.mjs';
import { upsertTrackerIssue } from './issue.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE_PATH = join(HERE, 'fingerprint.baseline.json');

const EXIT_CODES = { ok: 0, drift: 1, unreachable: 2, 'baseline-missing': 3 };

function realSleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function realNow() {
  return new Date().toISOString();
}

/**
 * Test-only escape hatch: WIKI_DRIFT_TEST_PORTS_MODULE points at a module exporting
 * `{ fetchImpl, sleep?, now? }` used instead of the real network/clock. Never set by the
 * shipped workflow — production always uses the real `fetch`, a real timer-based sleep, and the
 * real clock.
 */
async function resolvePorts() {
  const stubModulePath = process.env.WIKI_DRIFT_TEST_PORTS_MODULE;
  if (stubModulePath) {
    const stub = await import(pathToFileURL(stubModulePath).href);
    return {
      fetchImpl: stub.fetchImpl,
      sleep: stub.sleep ?? realSleep,
      now: stub.now ?? realNow,
    };
  }
  return { fetchImpl: fetch, sleep: realSleep, now: realNow };
}

function baselinePath() {
  return process.env.WIKI_DRIFT_BASELINE_PATH ?? DEFAULT_BASELINE_PATH;
}

function readBaselineTextSafely(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

async function run({ write, fetchImpl, sleep, now }) {
  const path = baselinePath();
  const baselineText = readBaselineTextSafely(path);
  const baselineResult = readBaseline(baselineText);

  // Stage 1 gate: with a bad baseline and no --write, stop here — no request is ever made.
  if (!write && !baselineResult.ok) {
    return { outcome: 'baseline-missing', reason: baselineResult.reason };
  }

  // Stage 2 (+3): the only network in the whole tool.
  const fetchResult = await fetchEndpoints({ fetchImpl, sleep });
  if (!fetchResult.ok) {
    return { outcome: 'unreachable', reason: fetchResult.reason, url: fetchResult.url };
  }

  const observedAt = now();
  const dataFp = fingerprintPayload(DATA_URL, fetchResult.payloads.data);
  const fasesNomesFp = fingerprintPayload(FASES_NOMES_URL, fetchResult.payloads.fasesNomes);

  if (write) {
    const baseline = {
      schemaVersion: 1,
      capturedAt: observedAt,
      endpoints: { data: dataFp, fasesNomes: fasesNomesFp },
    };
    writeFileSync(path, serializeBaseline(baseline));
    return { outcome: 'ok', wrote: true, path };
  }

  // Stage 4: compare. Unreachable was already returned above — this line is unreachable on any
  // fetch failure, by construction, not by a conditional here.
  const dataDiffs = compareFingerprints(baselineResult.baseline.endpoints.data, dataFp).map((d) => ({
    ...d,
    endpoint: 'data',
  }));
  const fasesNomesDiffs = compareFingerprints(baselineResult.baseline.endpoints.fasesNomes, fasesNomesFp).map(
    (d) => ({ ...d, endpoint: 'fasesNomes' }),
  );
  const diffs = [...dataDiffs, ...fasesNomesDiffs];

  if (diffs.length === 0) {
    return { outcome: 'ok', diffs: [] };
  }

  return { outcome: 'drift', diffs, observedAt };
}

async function main() {
  const write = process.argv.includes('--write');
  const { fetchImpl, sleep, now } = await resolvePorts();
  const result = await run({ write, fetchImpl, sleep, now });

  const runUrl = process.env.RUN_URL ?? '';
  const observedAt = result.observedAt ?? now();

  let issueNote = '';
  if (result.outcome === 'drift') {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (token && repo) {
      const title = renderIssueTitle(result.diffs);
      const body = renderIssueBody({ diffs: result.diffs, observedAt, runUrl });
      const issueResult = await upsertTrackerIssue({
        fetchImpl,
        token,
        repo,
        marker: TRACKER_MARKER,
        title,
        body,
      });
      if (issueResult.action === 'failed') {
        issueNote = `\nalert could not be filed: ${issueResult.reason}`;
      } else {
        issueNote = `\nissue ${issueResult.action}: ${issueResult.url}`;
      }
    } else {
      issueNote = '\nGITHUB_TOKEN/GITHUB_REPOSITORY not set — issue step skipped (local run)';
    }
  }

  const summary =
    renderSummary({
      outcome: result.outcome,
      diffs: result.diffs,
      reason: result.reason,
      url: result.url,
      observedAt,
      runUrl,
    }) + issueNote;

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    writeFileSync(summaryPath, `${summary}\n`, { flag: 'a' });
  }
  process.stdout.write(`${summary}\n`);

  process.exitCode = EXIT_CODES[result.outcome];
}

main();
