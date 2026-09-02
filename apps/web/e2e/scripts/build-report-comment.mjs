#!/usr/bin/env node
/**
 * Build the PR comment / job summary body for a failed e2e run.
 *
 * The comment names the diffs and points at the `e2e-report` artifact; it cannot show them.
 * Rendering one inline needs an https URL that outlives the comment, so it would mean hosting the
 * images somewhere — and inline base64 is not the way around that, because GitHub's markdown
 * sanitizer strips `data:` URIs from comments and job summaries alike.
 *
 * Env: RUN_URL, SMOKE_RESULT, VISUAL_RESULT
 * Writes: pr-comment.md
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIFF_DIR = path.join(ROOT, 'visual-diffs');
const OUT_FILE = path.join(ROOT, 'pr-comment.md');

const RUN_URL = process.env.RUN_URL || '';
const SMOKE_RESULT = process.env.SMOKE_RESULT || 'unknown';
const VISUAL_RESULT = process.env.VISUAL_RESULT || 'unknown';

const RESULT_ICON = {
  success: '✅ passed',
  failure: '❌ failed',
  cancelled: '⚪ cancelled',
  skipped: '⚪ skipped',
};

/** Group flattened PNGs into { base: { diff, expected, actual } }. */
function groupDiffs() {
  if (!fs.existsSync(DIFF_DIR)) return [];
  const groups = new Map();
  for (const name of fs.readdirSync(DIFF_DIR).sort((a, b) => a.localeCompare(b))) {
    const match = /^(.*)-(diff|expected|actual)\.png$/i.exec(name);
    if (!match) continue;
    const [, base, kind] = match;
    if (!groups.has(base)) groups.set(base, { base });
    groups.get(base)[kind.toLowerCase()] = name;
  }
  return [...groups.values()].filter((g) => g.diff || g.actual);
}

function resultRow(label, result) {
  return `| ${label} | ${RESULT_ICON[result] ?? result} |`;
}

function main() {
  const groups = groupDiffs();
  const lines = ['', '## Playwright e2e — review', ''];

  lines.push('| Suite | Result |', '| --- | --- |');
  lines.push(resultRow('smoke (4 shards)', SMOKE_RESULT));
  lines.push(resultRow('visual', VISUAL_RESULT));
  lines.push('');

  lines.push(
    `> Download the **\`e2e-report\`** artifact from the [run](${RUN_URL}) — it bundles the merged ` +
      'HTML report, with the expected / actual / diff comparator, and every diff image.',
    '',
  );

  if (groups.length === 0) {
    lines.push(
      '_No screenshot diffs were produced — these are behavioral failures. The report has the traces and error context._',
      '',
    );
  } else {
    lines.push(`### Screenshot diffs (${groups.length})`, '');
    for (const g of groups) {
      lines.push(`<details open><summary><code>${g.base}</code></summary>`, '');
      lines.push(`_Files: ${['expected', 'actual', 'diff'].filter((k) => g[k]).join(', ')}_`, '');
      lines.push('</details>', '');
    }
  }

  lines.push('---', '');

  // The approve/reject loop only makes sense when there are baselines to accept.
  if (groups.length > 0) {
    lines.push(
      '**Approve these baselines** — if every diff above is an intended UI change, add the ' +
        '`update-snapshots` label to this PR. CI regenerates the Linux Chromium screenshots and ' +
        'pushes them to this branch.',
      '',
      '**Reject** — if any diff is a regression, fix the product or the test. Do not relabel.',
      '',
    );
  }

  lines.push(
    `**Locally** — \`pnpm test:e2e:report:ci\` opens this run's report offline${
      groups.length > 0 ? ', `pnpm test:e2e:update` (Docker) accepts diffs' : ''
    }.`,
    '',
    `<sub>Traces, diff images and the full comparator are all in the \`e2e-report\` artifact on the [run](${RUN_URL}).</sub>`,
    '',
  );

  fs.writeFileSync(OUT_FILE, lines.join('\n'));
  console.log(`Wrote pr-comment.md — ${groups.length} diff group(s)`);
}

main();
