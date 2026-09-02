/**
 * The shape guard for the staleness alarm. A monitor that quietly stops asserting is worse than
 * none, because it turns an unmonitored system into one believed to be monitored — so the things
 * pinned here are the ones whose removal would leave a green check meaning nothing: the schedule,
 * the absence of an escape hatch, and each field the checker claims to read.
 *
 * Every predicate is a pure function over file text, asserted twice — true against the real file
 * on disk, false against a mutation of that same text — so none of them can report green while
 * having stopped discriminating.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOW_PATH = join(root, '.github/workflows/market-snapshot-freshness.yml');
const CHECKER_PATH = join(root, 'tools/market-snapshot/freshness.mjs');

const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const checker = readFileSync(CHECKER_PATH, 'utf8');

/** Comments here describe the very constraints under test; predicates must read code, not prose. */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function jobNames(text) {
  const lines = text.split('\n');
  const jobsIndex = lines.findIndex((line) => line === 'jobs:');
  if (jobsIndex === -1) return [];
  const names = [];
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (match) names.push(match[1]);
  }
  return names;
}

const hasLiveSchedule = (text) =>
  /^\s*schedule:\s*$/m.test(text) && /^\s*-\s*cron:\s*'[^']+'/m.test(text);
const runsEveryHour = (text) => /^\s*-\s*cron:\s*'\S+ \* \* \* \*'/m.test(text);
const singleJob = (text) => jobNames(text).length === 1;
const isTimeBoxed = (text) => /timeout-minutes:\s*\d+/.test(stripCommentLines(text));
const readOnlyContents = (text) =>
  /contents:\s*read/.test(text) && !/contents:\s*write/.test(text);
const runsTheChecker = (text) =>
  /run: node tools\/market-snapshot\/freshness\.mjs\s*$/m.test(stripCommentLines(text));
const noInstallStep = (text) => !/run:\s*(pnpm|npm|yarn)\s+install/.test(stripCommentLines(text));

const noEscapeHatch = (text) => {
  const code = stripCommentLines(text);
  return (
    !/continue-on-error:\s*true/.test(code) &&
    !/\|\|\s*true/.test(code) &&
    !/;\s*exit\s+0/.test(code) &&
    !/^\s*if:/m.test(code)
  );
};

const namesSteam = (text) => /steamcommunity\.com/.test(text);

const readsGeneratedUtc = (text) => /\bgeneratedUtc\b/.test(text);
const readsEntries = (text) => /\bentries\b/.test(text);
const readsMatchedCatalogKeys = (text) => /\bmatchedCatalogKeys\b/.test(text);
const readsResponseStatus = (text) => /status !== 200/.test(text);
const invokesItselfWhenRun = (text) =>
  /pathToFileURL\(process\.argv\[1\]\)\.href === import\.meta\.url/.test(text);

const thresholdDefinedOnce = (text) => (text.match(/MAX_AGE_HOURS\s*=/g) ?? []).length === 1;

describe('the staleness alarm workflow', () => {
  it('is scheduled, and scheduled hourly', () => {
    expect(hasLiveSchedule(workflow)).toBe(true);
    expect(hasLiveSchedule(workflow.replace('  schedule:', '  # schedule:'))).toBe(false);
    expect(hasLiveSchedule(workflow.replace(/^\s*-\s*cron:.*\n/m, ''))).toBe(false);

    expect(runsEveryHour(workflow)).toBe(true);
    // An alarm whose latency is comparable to its own threshold reports staleness far too late.
    expect(runsEveryHour(workflow.replace(/cron: '(\S+) \*/, "cron: '$1 */6"))).toBe(false);
  });

  it('is one time-boxed job that installs nothing', () => {
    expect(singleJob(workflow)).toBe(true);
    expect(singleJob(`${workflow}\n  freshness2:\n`)).toBe(false);

    expect(isTimeBoxed(workflow)).toBe(true);
    expect(isTimeBoxed(workflow.replace(/timeout-minutes:\s*\d+/, ''))).toBe(false);

    expect(noInstallStep(workflow)).toBe(true);
    expect(noInstallStep(`${workflow}\n      - run: pnpm install --frozen-lockfile\n`)).toBe(false);
  });

  it('reads only, and never reaches Steam', () => {
    expect(readOnlyContents(workflow)).toBe(true);
    expect(readOnlyContents(workflow.replace('contents: read', 'contents: write'))).toBe(false);

    expect(namesSteam(workflow)).toBe(false);
    expect(namesSteam(`${workflow}\n      - run: curl https://steamcommunity.com/market/\n`)).toBe(
      true,
    );
    expect(namesSteam(checker)).toBe(false);
    expect(namesSteam(`${checker}\nawait fetch('https://steamcommunity.com/market/');`)).toBe(true);
  });

  it('actually runs the checker, with no way for the run to pass regardless', () => {
    expect(runsTheChecker(workflow)).toBe(true);
    expect(
      runsTheChecker(
        workflow.replace('run: node tools/market-snapshot/freshness.mjs', 'run: true'),
      ),
    ).toBe(false);

    expect(noEscapeHatch(workflow)).toBe(true);
    expect(
      noEscapeHatch(
        workflow.replace(
          'run: node tools/market-snapshot/freshness.mjs',
          'run: node tools/market-snapshot/freshness.mjs || true',
        ),
      ),
    ).toBe(false);
    expect(
      noEscapeHatch(
        workflow.replace(
          '    runs-on: ubuntu-latest',
          "    if: github.event_name != 'schedule'\n    runs-on: ubuntu-latest",
        ),
      ),
    ).toBe(false);
    expect(noEscapeHatch(`${workflow}        continue-on-error: true\n`)).toBe(false);
  });
});

describe('the checker still reads what it claims to', () => {
  it('reads the timestamp, the entries, the catalog match and the response status', () => {
    expect(readsGeneratedUtc(checker)).toBe(true);
    expect(readsGeneratedUtc(checker.replaceAll('generatedUtc', 'stampedAt'))).toBe(false);

    expect(readsEntries(checker)).toBe(true);
    expect(readsEntries(checker.replaceAll('entries', 'rows'))).toBe(false);

    expect(readsMatchedCatalogKeys(checker)).toBe(true);
    expect(readsMatchedCatalogKeys(checker.replaceAll('matchedCatalogKeys', 'keyedRows'))).toBe(
      false,
    );

    expect(readsResponseStatus(checker)).toBe(true);
    expect(readsResponseStatus(checker.replace('status !== 200', 'status !== undefined'))).toBe(
      false,
    );
  });

  it('runs its check when the workflow invokes it as a script', () => {
    expect(invokesItselfWhenRun(checker)).toBe(true);
    expect(invokesItselfWhenRun(checker.replace(/if \(process\.argv\[1\][\s\S]*?\n}\n/, ''))).toBe(
      false,
    );
  });

  it('holds the freshness threshold in exactly one place', () => {
    expect(thresholdDefinedOnce(checker)).toBe(true);
    expect(thresholdDefinedOnce(`${checker}\nconst MAX_AGE_HOURS = 999;\n`)).toBe(false);
    expect(thresholdDefinedOnce(checker.replace(/MAX_AGE_HOURS\s*=\s*6/, 'THRESHOLD = 6'))).toBe(
      false,
    );
  });
});

describe('the alarm watches the file the apps read', () => {
  const shippedUrl = (path) => {
    const source = readFileSync(join(root, path), 'utf8');
    return source.match(/MARKET_SNAPSHOT_URL\s*=\s*\n?\s*'([^']+)'/)?.[1];
  };

  it('targets the same URL both shipped clients do', () => {
    const monitored = checker.match(/SNAPSHOT_URL\s*=\s*\n?\s*'([^']+)'/)?.[1];
    expect(monitored).toBeTruthy();

    expect(shippedUrl('apps/web/src/shared/lib/market-snapshot.ts')).toBe(monitored);
    expect(shippedUrl('apps/desktop/src/main/market/market-transport.ts')).toBe(monitored);
  });
});
