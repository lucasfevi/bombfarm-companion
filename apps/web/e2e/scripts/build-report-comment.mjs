#!/usr/bin/env node
/**
 * Build the PR comment / job summary body for a failed e2e run.
 *
 * Diff images are referenced by https URL from the published Pages report —
 * GitHub's markdown sanitizer strips `data:` URIs, so inline base64 can never
 * render in a comment or job summary.
 *
 * Env: REPORT_URL (empty when publishing was skipped), RUN_URL,
 *      SMOKE_RESULT, VISUAL_RESULT
 * Writes: pr-comment.md
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIFF_DIR = path.join(ROOT, 'visual-diffs');
const OUT_FILE = path.join(ROOT, 'pr-comment.md');

const REPORT_URL = (process.env.REPORT_URL || '').replace(/\/+$/, '');
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

  if (REPORT_URL) {
    lines.push(
      `### 🔍 [Open the merged report](${REPORT_URL}/)`,
      '',
      'Every shard — smoke and visual — in one HTML report, with the expected / actual / diff comparator.',
      '',
    );
  } else {
    lines.push(
      '> The online report was not published for this run (fork PR, or the failure happened before ' +
        'any test produced a report). Download the **`e2e-report`** artifact from the ' +
        `[run](${RUN_URL}) if it exists — it bundles the merged report and every diff.`,
      '',
    );
  }

  if (groups.length === 0) {
    lines.push(
      '_No screenshot diffs were produced — these are behavioral failures. The report has the traces and error context._',
      '',
    );
  } else {
    lines.push(`### Screenshot diffs (${groups.length})`, '');
    for (const g of groups) {
      lines.push(`<details open><summary><code>${g.base}</code></summary>`, '');
      if (REPORT_URL && g.diff) {
        lines.push(`<img alt="${g.base} diff" src="${REPORT_URL}/diffs/${g.diff}" width="900" />`, '');
      }
      if (REPORT_URL) {
        const links = ['expected', 'actual', 'diff']
          .filter((kind) => g[kind])
          .map((kind) => `[${kind}](${REPORT_URL}/diffs/${g[kind]})`)
          .join(' · ');
        lines.push(links, '');
      } else {
        lines.push(`_Files: ${['expected', 'actual', 'diff'].filter((k) => g[k]).join(', ')}_`, '');
      }
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
    `<sub>Trace files are stripped from the published report (the Pages site is public). Download the \`e2e-report\` artifact from the [run](${RUN_URL}) for traces.</sub>`,
    '',
  );

  fs.writeFileSync(OUT_FILE, lines.join('\n'));
  console.log(`Wrote pr-comment.md — ${groups.length} diff group(s), report ${REPORT_URL || '(unpublished)'}`);
}

main();
