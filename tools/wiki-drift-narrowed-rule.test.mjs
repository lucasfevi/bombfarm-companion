import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCAN_ROOTS = ['apps', 'packages'];
const HOSTNAME_PATTERN = 'wiki\\.bombfarm\\.net';

/**
 * The narrowed-rule guard, clauses A and B. Reuses this repo's established pattern for
 * a repo-wide identifier-absence guard: `execFileSync('git', ['grep', …])` plus a pinned census
 * that fails on widening **and** on silent narrowing, applied here to the wiki-client surface.
 *
 * Clause A bans a **client call** to the wiki host — not the hostname, which appears
 * legitimately 11 times (credit links, i18n strings, provenance comments). Clause B pins that
 * hostname surface as a census so an eighth appearance is a reviewable diff, not a silent one.
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
// Clause B — the census: the hostname's 7 legitimate files, pinned per-file with an exact count
// =============================================================================================

/**
 * Measured directly against this tree (`git grep -c "wiki\.bombfarm\.net" -- apps packages`):
 * 7 files, 11 matches. It was 8 files / 12 matches until the runtime URL builder in
 * `packages/game-data/src/parsers/inventory.ts` was deleted — item art is bundled-only, so no
 * shipped code composes a wiki URL any more. Every remaining entry is a credit link, an i18n
 * string, a test title, a provenance comment, or the `WIKI_URL` constant itself. The measured
 * tree is the authority here, per this repo's own precedent for reconciling docs against it.
 */
const HOSTNAME_CENSUS = [
  { file: 'apps/web/src/features/planner/components/explain-section.tsx', count: 2, owner: 'outbound wiki credit anchor + its label' },
  { file: 'apps/web/src/shared/i18n/namespaces/chrome.ts', count: 2, owner: 'wikiArtCreditLink EN + PT-BR' },
  { file: 'apps/web/src/tests/fixtures/i18n-strings-main.json', count: 2, owner: 'i18n parity fixture' },
  { file: 'apps/web/src/tests/game-art-chrome.test.ts', count: 1, owner: "test title naming the wiki host" },
  { file: 'packages/domain/src/model/index.ts', count: 1, owner: 'provenance comment' },
  { file: 'packages/domain/src/wiki-assets.ts', count: 1, owner: 'WIKI_URL constant declaration' },
  { file: 'packages/domain/tests/fixtures/i18n-strings-main.json', count: 2, owner: 'i18n parity fixture' },
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

describe('Clause B — the hostname census: 7 files, exact per-file counts, an owner for each', () => {
  it('the census is exactly the enumerated set, 7 entries, each with a positive count and an owner', () => {
    expect(HOSTNAME_CENSUS.length).toBe(7);
    expect(HOSTNAME_CENSUS.every((e) => e.file && e.count > 0 && e.owner)).toBe(true);
  });

  it('git grep -c "wiki\\.bombfarm\\.net" -- apps packages reports exactly these 7 files with these exact counts', () => {
    const actual = actualHostnameCensus();
    const expectedFiles = HOSTNAME_CENSUS.map((e) => e.file).sort();
    const actualFiles = Object.keys(actual).sort();

    expect(actualFiles, 'a file gained/lost a match, disappeared, or an eighth file appeared').toEqual(expectedFiles);

    for (const entry of HOSTNAME_CENSUS) {
      expect(actual[entry.file], `${entry.file} (${entry.owner}): match count`).toBe(entry.count);
    }
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
    delete observed['packages/domain/src/model/index.ts'];
    expect(censusMatches(HOSTNAME_CENSUS, observed)).toBe(false);
  });

  it('a simulated EIGHTH file fails the comparison', () => {
    const observed = Object.fromEntries(HOSTNAME_CENSUS.map((e) => [e.file, e.count]));
    observed['apps/web/src/some-new-file.ts'] = 1;
    expect(censusMatches(HOSTNAME_CENSUS, observed)).toBe(false);
  });

  it('the real (unmodified) census matches', () => {
    expect(censusMatches(HOSTNAME_CENSUS, actualHostnameCensus())).toBe(true);
  });
});

// =============================================================================================
// Clause C — the three amended files agree: both halves of the rule, plus the workflow filename
// (MWD-34, clause C)
// =============================================================================================

const WORKFLOW_FILENAME = '.github/workflows/wiki-drift.yml';

/** The "no wiki HTTP client in shipped app code" half. */
function hasNoClientInAppCodeHalf(text) {
  return /no wiki http client in shipped app code/i.test(text);
}

/** The "may not write packages/domain/**" half. */
function hasMayNotWriteDomainHalf(text) {
  return /may not write `?packages\/domain\/\*\*`?/i.test(text);
}

function hasWorkflowFilename(text) {
  return text.includes(WORKFLOW_FILENAME);
}

const CLAUSE_C_FILES = [
  'AGENTS.md',
  'apps/web/docs/architecture.md',
  'docs/wiki-drift-check.md',
];

describe('Clause C — AGENTS.md, apps/web/docs/architecture.md and docs/wiki-drift-check.md all carry the full rule', () => {
  for (const file of CLAUSE_C_FILES) {
    const text = readFileSync(join(root, file), 'utf8');

    it(`${file} carries the "no client in app code" half`, () => {
      expect(hasNoClientInAppCodeHalf(text)).toBe(true);
    });

    it(`${file} carries the "may not write packages/domain/**" half`, () => {
      expect(hasMayNotWriteDomainHalf(text)).toBe(true);
    });

    it(`${file} names the workflow file ${WORKFLOW_FILENAME}`, () => {
      expect(hasWorkflowFilename(text)).toBe(true);
    });
  }
});

describe('Clause C — red states: losing any one of the three elements turns the file non-compliant (MWD-34)', () => {
  const realAgentsText = readFileSync(join(root, 'AGENTS.md'), 'utf8');

  it('dropping the "no client in app code" half turns hasNoClientInAppCodeHalf false', () => {
    const mutated = realAgentsText.replace(/no wiki http client in shipped app code\.?/i, '');
    expect(hasNoClientInAppCodeHalf(mutated)).toBe(false);
    // The other two elements are untouched by this specific mutation.
    expect(hasWorkflowFilename(mutated)).toBe(true);
  });

  it('dropping the "may not write packages/domain/**" half turns hasMayNotWriteDomainHalf false', () => {
    const mutated = realAgentsText.replace(/may not write `packages\/domain\/\*\*`/i, '');
    expect(hasMayNotWriteDomainHalf(mutated)).toBe(false);
    expect(hasNoClientInAppCodeHalf(mutated)).toBe(true);
  });

  it('dropping the workflow filename turns hasWorkflowFilename false', () => {
    const mutated = realAgentsText.replaceAll(WORKFLOW_FILENAME, '');
    expect(hasWorkflowFilename(mutated)).toBe(false);
    expect(hasNoClientInAppCodeHalf(mutated)).toBe(true);
    expect(hasMayNotWriteDomainHalf(mutated)).toBe(true);
  });
});

// =============================================================================================
// MWD-32 — reference hygiene: no research-repo name, no bot-repo name, no specs-directory path, no
// private decision identifier, in any file this feature authored end-to-end
// =============================================================================================

/** Files F5 wrote from scratch — 100% of their content is this feature's own responsibility, so
 * a whole-file scan is fair. (Files F5 only partially edited — AGENTS.md, `architecture.md`,
 * `ci-desktop-paths.test.mjs` — carry unrelated pre-existing content this feature does not own
 * and does not scan here; Clause C above already checks the specific clauses F5 authored in the
 * first two.) */
const FULLY_AUTHORED_FILES = [
  'docs/wiki-drift-check.md',
  '.github/workflows/wiki-drift.yml',
  'tools/wiki-drift/fingerprint.mjs',
  'tools/wiki-drift/fetch-endpoints.mjs',
  'tools/wiki-drift/report.mjs',
  'tools/wiki-drift/issue.mjs',
  'tools/wiki-drift/check.mjs',
  'tools/wiki-drift-fingerprint.test.mjs',
  'tools/wiki-drift-compare.test.mjs',
  'tools/wiki-drift-fetch.test.mjs',
  'tools/wiki-drift-report.test.mjs',
  'tools/wiki-drift-issue.test.mjs',
  'tools/wiki-drift-cli.test.mjs',
  'tools/wiki-drift-workflow.test.mjs',
  // NOT this guard's own file: its red-state fixtures below necessarily name the forbidden
  // patterns to prove the scan catches them — the same self-reference exemption this repo's
  // other repo-wide identifier-absence guard takes for itself.
];

// This guard must not spell the names it exists to catch — the same self-reference problem a
// "no console.log" lint rule has to dodge in its own implementation. Earlier revisions assembled
// each name from parts (`['bombfarm', 'x'].join('-')`), which defeats `git grep` but still shows
// the name to anyone reading the file. A negative lookahead on this repo's OWN name avoids
// naming a sibling at all, and catches a sibling added later for free.
const SIBLING_REPO_PATTERN = /bombfarm-(?!companion)[a-z][a-z-]*/i;
const SPECS_DIR_SEGMENT = ['.specs', '/'].join('');

const FORBIDDEN_REFERENCE_PATTERNS = [
  { name: 'sibling-repo name', pattern: SIBLING_REPO_PATTERN },
  { name: 'specs-directory path', pattern: new RegExp(SPECS_DIR_SEGMENT.replace('.', '\\.').replace('/', '\\/')) },
  { name: 'AD-prefixed decision id', pattern: /\bAD-\d+\b/ },
  { name: 'bare D-number decision id', pattern: /\bD\d{1,3}\b/ },
];

function referenceHygieneOffenses(text) {
  return FORBIDDEN_REFERENCE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map((p) => p.name);
}

describe('MWD-32 — reference hygiene: no sibling-repo name, specs-directory path, or private decision id', () => {
  for (const file of FULLY_AUTHORED_FILES) {
    it(`${file} carries none of the forbidden references`, () => {
      const text = readFileSync(join(root, file), 'utf8');
      expect(referenceHygieneOffenses(text), file).toEqual([]);
    });
  }

  // The fixture names a sibling that does not exist, so this public file exercises the guard
  // without naming a real private repo.
  it('red state: a fixture string naming a sibling repo is caught', () => {
    const fixture = `See bombfarm-elsewhere/${SPECS_DIR_SEGMENT}features/mp5-wiki-drift-check/design.md (AD-092).`;
    expect(referenceHygieneOffenses(fixture)).toEqual(
      expect.arrayContaining(['sibling-repo name', 'specs-directory path', 'AD-prefixed decision id']),
    );
  });

  it('green state: this repo\'s own name is not an offense', () => {
    expect(referenceHygieneOffenses('See the bombfarm-companion README.')).toEqual([]);
  });

  it('red state: a fixture string naming a bare decision id is caught', () => {
    const fixture = 'This follows D25 exactly.';
    expect(referenceHygieneOffenses(fixture)).toEqual(['bare D-number decision id']);
  });
});
