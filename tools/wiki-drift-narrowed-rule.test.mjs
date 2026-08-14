import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCAN_ROOTS = ['apps', 'packages'];
const HOSTNAME_PATTERN = 'wiki\\.bombfarm\\.net';

/**
 * MP5 F5 (T9, `AD-095`) — the narrowed-rule guard, clauses A and B. Reuses
 * `tools/keystone-surface-absence.test.mjs`'s `execFileSync('git', ['grep', …])` shape and its
 * `AD-038` census pattern (fails on widening **and** on silent narrowing), applied here to the
 * wiki-client surface instead of the keystone-identifier surface.
 *
 * Clause A bans a **client call** to the wiki host — not the hostname, which appears
 * legitimately 8 times (credit links, i18n strings, provenance comments, a runtime URL builder
 * nothing renders today). Clause B pins that hostname surface as a census so a ninth appearance
 * is a reviewable diff, not a silent one.
 */

function gitGrep(pattern, pathspecs, flags = '-nE') {
  let out;
  try {
    out = execFileSync('git', ['grep', flags, pattern, '--', ...pathspecs], { cwd: root, encoding: 'utf8' });
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
  return out.split('\n').filter(Boolean);
}

function gitGrepLineMatches(pattern, pathspecs) {
  return gitGrep(pattern, pathspecs).map((line) => {
    const firstColon = line.indexOf(':');
    const secondColon = line.indexOf(':', firstColon + 1);
    return { file: line.slice(0, firstColon), lineNo: Number(line.slice(firstColon + 1, secondColon)) };
  });
}

const CLIENT_CALL_TOKENS = [
  'fetch(', 'axios', 'XMLHttpRequest', 'http.request', 'https.request', 'https.get', 'got(', 'node-fetch',
];

/** True if any HTTP-client-call token appears in a three-line text window. */
function windowContainsClientCall(windowText) {
  return CLIENT_CALL_TOKENS.some((token) => windowText.includes(token));
}

/** True if a file's whole text contains a client call whose URL argument comes from `WIKI_URL`
 * (the constant in `packages/domain/src/wiki-assets.ts`), i.e. a call fed straight from the
 * import rather than a hand-typed hostname string. */
function fileContainsWikiUrlClientCall(fileText) {
  const pattern = /(fetch|axios(?:\.\w+)?|new\s+XMLHttpRequest|https?\.request|https\.get|got)\s*\([^)]*WIKI_URL/;
  return pattern.test(fileText);
}

function threeLineWindow(fileAbsPath, lineNo) {
  const lines = readFileSync(fileAbsPath, 'utf8').split('\n');
  const start = Math.max(0, lineNo - 2);
  const end = Math.min(lines.length, lineNo + 1);
  return lines.slice(start, end).join('\n');
}

// =============================================================================================
// Clause A — the rule: hard zero, no allowlist
// =============================================================================================

describe('Clause A — no HTTP client call targeting the wiki host, anywhere under apps/** or packages/**', () => {
  it('non-vacuity: the scan roots resolve to a non-empty, non-trivial file set (> 500 files)', () => {
    const allFiles = execFileSync('git', ['ls-files', '--', ...SCAN_ROOTS], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(allFiles.length, `scanned roots: ${SCAN_ROOTS.join(', ')}`).toBeGreaterThan(500);
  });

  it('a three-line window around every wiki.bombfarm.net occurrence carries zero client-call tokens', () => {
    const occurrences = gitGrepLineMatches(HOSTNAME_PATTERN, SCAN_ROOTS);
    expect(occurrences.length, 'non-vacuity: the hostname must appear at least once today').toBeGreaterThan(0);

    const offenders = occurrences.filter((occ) => {
      const windowText = threeLineWindow(join(root, occ.file), occ.lineNo);
      return windowContainsClientCall(windowText);
    });
    expect(offenders, `client-call token near the hostname: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('red state: windowContainsClientCall matches a fixture window with an inline client call', () => {
    const fixtureWindow = 'const url = `https://wiki.bombfarm.net/wiki/api/data`;\nfetch(url).then(r => r.json());\n';
    expect(windowContainsClientCall(fixtureWindow)).toBe(true);
  });

  it('zero files contain a client call whose URL argument is WIKI_URL', () => {
    const candidateFiles = gitGrep('WIKI_URL', SCAN_ROOTS, '-l');
    const offenders = candidateFiles.filter((file) =>
      fileContainsWikiUrlClientCall(readFileSync(join(root, file), 'utf8')),
    );
    expect(offenders, `WIKI_URL fed directly into a client call: ${offenders.join(', ')}`).toEqual([]);
  });

  it("red state: fileContainsWikiUrlClientCall matches fetch(`${WIKI_URL}/wiki/api/data`)", () => {
    const fixture = 'import { WIKI_URL } from \'./wiki-assets\';\nfetch(`${WIKI_URL}/wiki/api/data`);\n';
    expect(fileContainsWikiUrlClientCall(fixture)).toBe(true);
  });
});

// =============================================================================================
// Clause B — the census: the hostname's 8 legitimate files, pinned per-file with an exact count
// =============================================================================================

/**
 * Measured directly against this tree (`git grep -c "wiki\.bombfarm\.net" -- apps packages`):
 * 8 files, 12 matches. Design's own §2.5 table (not its summary prose) sums to the same 12 —
 * every one of its per-file counts below is reproduced verbatim; only the prose total this test
 * does not repeat ("14") was arithmetically wrong. The tree wins over that one summary figure,
 * per this repo's own precedent for reconciling spec/design against the measured tree.
 */
const HOSTNAME_CENSUS = [
  { file: 'apps/web/src/features/planner/components/explain-section.tsx', count: 2, owner: 'outbound wiki credit anchor + its label' },
  { file: 'apps/web/src/shared/i18n/namespaces/chrome.ts', count: 2, owner: 'wikiArtCreditLink EN + PT-BR' },
  { file: 'apps/web/src/tests/fixtures/i18n-strings-main.json', count: 2, owner: 'i18n parity fixture' },
  { file: 'apps/web/src/tests/game-art-chrome.test.ts', count: 1, owner: "test title naming the wiki host" },
  { file: 'packages/domain/src/model/index.ts', count: 1, owner: 'provenance comment' },
  { file: 'packages/domain/src/wiki-assets.ts', count: 1, owner: 'WIKI_URL constant declaration' },
  { file: 'packages/domain/tests/fixtures/i18n-strings-main.json', count: 2, owner: 'i18n parity fixture' },
  {
    file: 'packages/game-data/src/parsers/inventory.ts',
    count: 1,
    owner: 'runtime URL builder (computeIconUrl) — a URL builder that nothing renders today; a future caller would need docs/wiki-drift-check.md amended first',
  },
];

function actualHostnameCensus() {
  const rows = gitGrep(HOSTNAME_PATTERN, SCAN_ROOTS);
  const counts = {};
  for (const line of rows) {
    const file = line.slice(0, line.indexOf(':'));
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
}

describe('Clause B — the hostname census: 8 files, exact per-file counts, an owner for each', () => {
  it('the census is exactly the enumerated set, 8 entries, each with a positive count and an owner', () => {
    expect(HOSTNAME_CENSUS.length).toBe(8);
    expect(HOSTNAME_CENSUS.every((e) => e.file && e.count > 0 && e.owner)).toBe(true);
  });

  it('git grep -c "wiki\\.bombfarm\\.net" -- apps packages reports exactly these 8 files with these exact counts', () => {
    const actual = actualHostnameCensus();
    const expectedFiles = HOSTNAME_CENSUS.map((e) => e.file).sort();
    const actualFiles = Object.keys(actual).sort();

    expect(actualFiles, 'a file gained/lost a match, disappeared, or a ninth file appeared').toEqual(expectedFiles);

    for (const entry of HOSTNAME_CENSUS) {
      expect(actual[entry.file], `${entry.file} (${entry.owner}): match count`).toBe(entry.count);
    }
  });

  it('the inventory.ts entry is explicitly noted as a URL builder nothing renders today', () => {
    const entry = HOSTNAME_CENSUS.find((e) => e.file === 'packages/game-data/src/parsers/inventory.ts');
    expect(entry.owner).toMatch(/nothing renders today/);
  });
});

/** Compares an expected `{file, count}` census against an observed count map — the same shape
 * `actualHostnameCensus()` produces. Fails on either an unexpected file OR a mismatched count,
 * so widening the surface and silently narrowing it are both caught. Tested here over synthetic
 * inputs so both failure directions are provable without touching git. */
function censusMatches(expected, observed) {
  const expectedFiles = expected.map((e) => e.file).sort();
  const observedFiles = Object.keys(observed).sort();
  if (JSON.stringify(expectedFiles) !== JSON.stringify(observedFiles)) return false;
  return expected.every((e) => observed[e.file] === e.count);
}

describe('Clause B — the comparison logic itself fails in both directions (synthetic census inputs)', () => {
  it('a simulated EXTRA match on an already-pinned file fails the comparison', () => {
    const observed = Object.fromEntries(HOSTNAME_CENSUS.map((e) => [e.file, e.count]));
    observed['packages/domain/src/wiki-assets.ts'] += 1; // widened
    expect(censusMatches(HOSTNAME_CENSUS, observed)).toBe(false);
  });

  it('a simulated REMOVED file fails the comparison (silent narrowing)', () => {
    const observed = Object.fromEntries(HOSTNAME_CENSUS.map((e) => [e.file, e.count]));
    delete observed['packages/game-data/src/parsers/inventory.ts'];
    expect(censusMatches(HOSTNAME_CENSUS, observed)).toBe(false);
  });

  it('a simulated NINTH file fails the comparison', () => {
    const observed = Object.fromEntries(HOSTNAME_CENSUS.map((e) => [e.file, e.count]));
    observed['apps/web/src/some-new-file.ts'] = 1;
    expect(censusMatches(HOSTNAME_CENSUS, observed)).toBe(false);
  });

  it('the real (unmodified) census matches', () => {
    expect(censusMatches(HOSTNAME_CENSUS, actualHostnameCensus())).toBe(true);
  });
});
