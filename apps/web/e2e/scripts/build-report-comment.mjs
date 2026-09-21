#!/usr/bin/env node
/**
 * Build the PR comment / job summary body for a failed smoke e2e run.
 *
 * The comment points at the `e2e-report` artifact; it cannot embed the report. GitHub's markdown
 * sanitizer strips `data:` URIs from comments and job summaries alike, so inline images are not
 * an option either.
 *
 * Env: RUN_URL, SMOKE_RESULT, SHARD_TOTAL
 * Writes: pr-comment.md
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_FILE = path.join(process.cwd(), 'pr-comment.md');

const RUN_URL = process.env.RUN_URL || '';
const SMOKE_RESULT = process.env.SMOKE_RESULT || 'unknown';
const SHARD_TOTAL = process.env.SHARD_TOTAL || '';

const RESULT_ICON = {
  success: '✅ passed',
  failure: '❌ failed',
  cancelled: '⚪ cancelled',
  skipped: '⚪ skipped',
};

function main() {
  const smokeLabel = SHARD_TOTAL ? `smoke (${SHARD_TOTAL} shards)` : 'smoke';
  const lines = [
    '',
    '## Playwright e2e — review',
    '',
    '| Suite | Result |',
    '| --- | --- |',
    `| ${smokeLabel} | ${RESULT_ICON[SMOKE_RESULT] ?? SMOKE_RESULT} |`,
    '',
    `> Download the **\`e2e-report\`** artifact from the [run](${RUN_URL}) — it bundles the merged ` +
      'HTML report with the traces and error context for every failed test.',
    '',
    '**Locally** — `node e2e/scripts/show-ci-report.mjs` (from `apps/web`) downloads that artifact and opens it offline.',
    '',
  ];

  fs.writeFileSync(OUT_FILE, lines.join('\n'));
  console.log('Wrote pr-comment.md');
}

main();
