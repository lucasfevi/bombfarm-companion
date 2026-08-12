/**
 * The four architectural guards this feature rests on (mp2-live-account-read T10). Each reads
 * source, not `dist`, and never depends on build output — a guard that found zero files would
 * pass vacuously, which is exactly the shape this repo has been bitten by before, so every guard
 * below also asserts it found a non-empty file set.
 *
 * Every guard's red state was demonstrated once against a temporary violating line (recorded
 * verbatim in the T10 commit's task notes) and reverted before this file was committed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const GAME_API_SRC = join(REPO_ROOT, 'packages/game-api/src');
const DESKTOP_MAIN = join(REPO_ROOT, 'apps/desktop/src/main');
const HTTPS_TRANSPORT_FILE = join(DESKTOP_MAIN, 'game-api/https-transport.ts');
const SESSION_TOKEN_FILE_FILE = join(DESKTOP_MAIN, 'game-api/session-token-file.ts');
const REQUEST_FILE = join(GAME_API_SRC, 'request.ts');
const ACCOUNT_REFRESH_FILE = join(DESKTOP_MAIN, 'game-api/account-refresh.ts');
/** This guard file itself necessarily names the strings it checks for — excluded from every scan. */
const BOUNDARIES_TEST_FILE = join(DESKTOP_MAIN, 'game-api/boundaries.test.ts');

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isTestFile(file: string): boolean {
  return /\.test\.ts$/.test(file);
}

// -------------------------------------------------------------------------------------------
// Guard 1 — no write surface (LAR-13, LAR-24). packages/game-api/src's non-test source only.
// -------------------------------------------------------------------------------------------

describe('Guard 1 — packages/game-api has no write surface (D24, LAR-13, LAR-24)', () => {
  const sourceFiles = walkTsFiles(GAME_API_SRC).filter((f) => !isTestFile(f));

  it('scans a non-empty set of non-test source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('contains no POST/PUT/PATCH/DELETE HTTP method literal', () => {
    const methodPattern = /['"](POST|PUT|PATCH|DELETE)['"]/;
    const offenders = sourceFiles
      .map((file) => ({ file, match: methodPattern.exec(readFileSync(file, 'utf8')) }))
      .filter((r) => r.match !== null);
    expect(offenders, `D24: the write surface stays in bombfarm-bot. Offenders: ${JSON.stringify(offenders.map((o) => o.file))}`).toEqual([]);
  });

  it('names no host other than the single api.bombfarm.net constant', () => {
    // Domain-shaped quoted strings with a real TLD — filters out symbol names / filenames like
    // 'bfc.session.raw' or 'api-bodies.json', which are not hosts.
    const hostPattern = /['"]((?:[a-z0-9-]+\.)+(?:net|com|org|io|dev))['"]/gi;
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      const re = new RegExp(hostPattern);
      while ((match = re.exec(text))) {
        const host = match[1];
        if (host && host !== 'api.bombfarm.net') {
          offenders.push(`${file}: ${host}`);
        }
      }
    }
    expect(offenders, `LAR-13: only api.bombfarm.net is allowed. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('contains no dotted-quad IP literal (TD-9 — no Cloudflare fixed-IP fallback)', () => {
    // Negative lookahead excludes the game build string '0.1.0.0+2026-08-11T21:38:23Z'
    // (fingerprints.ts) — semver build metadata, not an IP; a real IP is never followed by '+'.
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b(?!\+)/;
    const offenders = sourceFiles
      .map((file) => ({ file, match: ipPattern.exec(readFileSync(file, 'utf8')) }))
      .filter((r) => r.match !== null);
    expect(offenders, `LAR-24/TD-9: no IP fallback. Offenders: ${JSON.stringify(offenders.map((o) => o.file))}`).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// Guard 2 — one socket (AD-024, TD-11). Only https-transport.ts may import a transport library.
// -------------------------------------------------------------------------------------------

describe('Guard 2 — https-transport.ts is the sole transport-library importer (AD-024)', () => {
  // Explicit, minimal allow-list: electron-updater's own GitHub calls and renderer/** are out of
  // scope for this guard (they are not on the account-read path this feature owns).
  const scannedFiles = [...walkTsFiles(GAME_API_SRC), ...walkTsFiles(DESKTOP_MAIN)].filter((f) => !isTestFile(f));

  it('scans a non-empty set of non-test source files', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it('no module outside https-transport.ts imports node:https, node:http, undici, axios or names fetch(', () => {
    const importPattern =
      /(?:from\s+['"](node:https|node:http|undici|axios)['"]|require\(\s*['"](node:https|node:http|undici|axios)['"]\s*\))/;
    const fetchPattern = /\bfetch\s*\(/;
    const offenders: string[] = [];
    for (const file of scannedFiles) {
      if (file === HTTPS_TRANSPORT_FILE) continue;
      const text = readFileSync(file, 'utf8');
      if (importPattern.test(text) || fetchPattern.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `AD-024: https-transport.ts is the only socket. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('https-transport.ts itself does import node:https (sanity — the guard is not vacuous)', () => {
    const text = readFileSync(HTTPS_TRANSPORT_FILE, 'utf8');
    expect(text).toMatch(/from ['"]node:https['"]/);
  });
});

// -------------------------------------------------------------------------------------------
// Guard 3 — no unconsented path (LAR-06, LAR-11).
// -------------------------------------------------------------------------------------------

describe('Guard 3 — no path to the network or the token file bypasses consent (LAR-06, LAR-11)', () => {
  const allFiles = [...walkTsFiles(GAME_API_SRC), ...walkTsFiles(DESKTOP_MAIN)];
  const nonTestFiles = allFiles.filter((f) => !isTestFile(f));

  it('scans a non-empty set of files', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('app_userdata (the session.cfg directory) appears only in session-token-file.ts (+ its own test)', () => {
    const offenders = allFiles.filter((file) => {
      if (
        file === SESSION_TOKEN_FILE_FILE ||
        file === SESSION_TOKEN_FILE_FILE.replace(/\.ts$/, '.test.ts') ||
        file === BOUNDARIES_TEST_FILE
      ) {
        return false;
      }
      return readFileSync(file, 'utf8').includes('app_userdata');
    });
    expect(offenders, `LAR-11: only session-token-file.ts opens the token file's directory. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('the token is dereferenced via [RAW] only in request.ts among non-test files', () => {
    const derefPattern = /\.token\[RAW\]/;
    const offenders = nonTestFiles.filter((file) => file !== REQUEST_FILE && derefPattern.test(readFileSync(file, 'utf8')));
    expect(offenders, `LAR-12: request.ts is the only reader of the raw token. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('every caller of requestGet()/readSection() obtained its session via grantSession() (a ConsentedSession)', () => {
    const offenders: string[] = [];
    for (const file of nonTestFiles) {
      const text = readFileSync(file, 'utf8');
      const callsIntoNetwork = /\brequestGet\(/.test(text) || /\breadSection\(/.test(text);
      if (!callsIntoNetwork) continue;
      const provesConsent = text.includes('ConsentedSession') || text.includes('grantSession(');
      if (!provesConsent) {
        offenders.push(file);
      }
    }
    expect(offenders, `LAR-06: every network call site must be typed to a ConsentedSession. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('sanity: at least one file does call requestGet/readSection (the guard above is not vacuous)', () => {
    const callers = nonTestFiles.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /\brequestGet\(/.test(text) || /\breadSection\(/.test(text);
    });
    expect(callers.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------------------------------
// Guard 4 — memory does not populate the account (LAR-26, D24).
// -------------------------------------------------------------------------------------------

const FORBIDDEN_MODULE_MARKERS = ['memory-scanner', 'koffi', 'candidates'];
const FORBIDDEN_NAMES = ['pickHighestGoldCandidate'];

/**
 * A fully `import type { ... } from '...'` statement is erased at compile time — it cannot
 * smuggle in a runtime dependency, so it is deliberately excluded here (this is exactly the
 * shape `account-refresh.ts` uses to reuse `game-reader-service.ts`'s `AccountCommitter`
 * interface without ever importing its koffi-loading module at runtime).
 */
function parseImportSpecifiers(text: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(text))) {
    const clause = match[1]?.trim() ?? '';
    const specifier = match[2];
    if (!specifier || /^type\b/.test(clause)) continue;
    specifiers.push(specifier);
  }
  return specifiers;
}

function importedNamesFrom(text: string, specifier: string): string[] {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"]${escaped}['"]`);
  const match = re.exec(text);
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/)[0]?.trim() ?? '')
    .filter((s) => s.length > 0);
}

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  const dir = dirname(fromFile);
  let target = resolve(dir, specifier);
  if (target.endsWith('.js')) target = target.slice(0, -3);
  const candidates = [`${target}.ts`, join(target, 'index.ts')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

interface GraphViolation {
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
}

function walkImportGraph(startFile: string): { violations: GraphViolation[]; visited: Set<string> } {
  const violations: GraphViolation[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startFile];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || visited.has(file)) continue;
    visited.add(file);

    const text = readFileSync(file, 'utf8');
    for (const specifier of parseImportSpecifiers(text)) {
      const markerHit = FORBIDDEN_MODULE_MARKERS.find((marker) => specifier.includes(marker));
      if (markerHit) {
        violations.push({ file, specifier, reason: `forbidden module marker "${markerHit}"` });
      }
      for (const name of importedNamesFrom(text, specifier)) {
        if (FORBIDDEN_NAMES.includes(name)) {
          violations.push({ file, specifier, reason: `forbidden import "${name}"` });
        }
      }
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(file, specifier);
        if (resolved) queue.push(resolved);
      }
    }
  }

  return { violations, visited };
}

describe('Guard 4 — the account path never reaches memory (LAR-26, D24)', () => {
  const { violations, visited } = walkImportGraph(ACCOUNT_REFRESH_FILE);

  it('walked a non-empty import graph from account-refresh.ts', () => {
    expect(visited.size).toBeGreaterThan(0);
    expect(visited.has(ACCOUNT_REFRESH_FILE)).toBe(true);
  });

  it('reaches no edge to memory-scanner, koffi, candidates.ts, or pickHighestGoldCandidate', () => {
    expect(
      violations,
      `D24: no account-state memory path, in this feature or as a fallback. Violations: ${JSON.stringify(violations)}`,
    ).toEqual([]);
  });
});
