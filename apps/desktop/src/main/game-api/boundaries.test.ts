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
/** The market price path's one socket. Read-only and unauthenticated — it carries no session
 *  token and reads a published file, not the player's account — so it is exempted from the
 *  account path's single-socket and single-host rules by file, never by widening either rule for
 *  the whole tree. Everything else below still applies to it, the no-write-verb scan included. */
const MARKET_TRANSPORT_FILE = join(DESKTOP_MAIN, 'market/market-transport.ts');
const MARKET_SNAPSHOT_HOST = 'raw.githubusercontent.com';
const SESSION_TOKEN_FILE_FILE = join(DESKTOP_MAIN, 'game-api/session-token-file.ts');
const REQUEST_FILE = join(GAME_API_SRC, 'request.ts');
/** The one write surface. It may name `POST` and exactly the two forge routes below, and nothing
 *  else in either tree may name either — the read-only posture is reversed for that width only. */
const FORGE_REQUEST_FILE = join(GAME_API_SRC, 'forge-request.ts');
const FORGE_ROUTE_PATHS = ['/item/forge', '/item/forge_to_safe'];
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
// Guard 1 — one write surface, two routes wide. Every source file that can reach the network:
// packages/game-api/src (the classification/typing half) AND apps/desktop/src/main (the one
// real socket, https-transport.ts, plus everything around it) — the scan used to cover only the
// former, which is exactly why a hard-coded non-GET method in https-transport.ts was invisible
// to it (see the T-fix-1 commit notes: `'PO' + 'ST'` passed this guard untouched before this fix).
// `POST` is allowed in forge-request.ts alone; PUT/PATCH/DELETE stay forbidden everywhere.
// -------------------------------------------------------------------------------------------

/**
 * Repeatedly folds adjacent quoted-string-literal concatenations (`'PO' + 'ST'` -> `'POST'`,
 * including longer chains like `'P'+'O'+'S'+'T'`) so the method-literal scan below cannot be
 * defeated by splitting a forbidden verb across a `+` expression — the exact obfuscation the
 * Verifier used. This only folds literal + literal chains; it makes no attempt to evaluate a
 * fully computed value (a function call, a variable, `String.fromCharCode(...)`, etc.) — that
 * broader class is instead closed by the dedicated "forwards req.method verbatim" assertion
 * below, which does not need to know what a computed value evaluates to because it forbids any
 * non-passthrough expression in the one place (`https-transport.ts`) that can reach the socket.
 */
function foldStringConcatenation(text: string): string {
  const concatPattern = /(['"])((?:\\.|(?!\1).)*)\1\s*\+\s*(['"])((?:\\.|(?!\3).)*)\3/g;
  let folded = text;
  let previous: string;
  do {
    previous = folded;
    folded = folded.replace(concatPattern, (_match, _q1: string, s1: string, _q2: string, s2: string) => `'${s1}${s2}'`);
  } while (folded !== previous);
  return folded;
}

/** Well-known non-routable loopback addresses used only by the dev renderer URL in `env.ts`
 *  (`http://127.0.0.1:3000`) — never reachable outside the local machine, structurally incapable
 *  of being an alternate write-surface or IP-fallback target, so excluded the same way the
 *  semver build-metadata string already is above. */
const LOOPBACK_IPS = new Set(['127.0.0.1', '0.0.0.0']);

describe('Guard 1 — one write surface, two routes wide, anywhere the network can be reached', () => {
  const sourceFiles = [...walkTsFiles(GAME_API_SRC), ...walkTsFiles(DESKTOP_MAIN)].filter((f) => !isTestFile(f));

  it('scans a non-empty set of non-test source files, including apps/desktop/src/main', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(sourceFiles).toContain(HTTPS_TRANSPORT_FILE);
  });

  it('contains no PUT/PATCH/DELETE HTTP method literal anywhere, and a POST literal only in forge-request.ts — including one assembled via string concatenation', () => {
    const offenders = sourceFiles
      .map((file) => {
        const methodPattern = file === FORGE_REQUEST_FILE ? /['"](PUT|PATCH|DELETE)['"]/ : /['"](POST|PUT|PATCH|DELETE)['"]/;
        return { file, match: methodPattern.exec(foldStringConcatenation(readFileSync(file, 'utf8'))) };
      })
      .filter((r) => r.match !== null);
    expect(offenders, `forge-request.ts is the one write surface, and it may only POST. Offenders: ${JSON.stringify(offenders.map((o) => o.file))}`).toEqual([]);
  });

  it('forge-request.ts itself does name POST (sanity — its exemption is not vacuous)', () => {
    expect(/['"]POST['"]/.test(readFileSync(FORGE_REQUEST_FILE, 'utf8'))).toBe(true);
  });

  it('forge-request.ts names no path literal other than the two forge routes', () => {
    const text = foldStringConcatenation(readFileSync(FORGE_REQUEST_FILE, 'utf8'));
    const pathLiterals = Array.from(text.matchAll(/['"](\/[^'"]*)['"]/g), (match) => match[1]);
    expect(pathLiterals.length, 'sanity: forge-request.ts must name its routes as path literals').toBeGreaterThan(0);
    expect(new Set(pathLiterals), `forge-request.ts may name exactly ${JSON.stringify(FORGE_ROUTE_PATHS)}. Found: ${JSON.stringify(pathLiterals)}`).toEqual(new Set(FORGE_ROUTE_PATHS));
  });

  it('no file other than forge-request.ts contains a POST literal or names either forge route', () => {
    const offenders = sourceFiles.filter((file) => {
      if (file === FORGE_REQUEST_FILE) return false;
      const text = foldStringConcatenation(readFileSync(file, 'utf8'));
      return /['"]POST['"]/.test(text) || FORGE_ROUTE_PATHS.some((route) => text.includes(route));
    });
    expect(offenders, `Only forge-request.ts may POST or name a forge route. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('names no host other than app.bombfarm.net, and the market snapshot host only in the market transport', () => {
    // Two shapes, because a host can be named either as a bare quoted string or as the authority
    // inside a full URL literal — the bare-string form alone let `'https://elsewhere.com/path'`
    // through, since the closing quote never followed the TLD.
    // The bare form filters out symbol names / filenames like 'bfc.session.raw' or
    // 'api-bodies.json', which are not hosts.
    const hostPatterns = [
      /['"]((?:[a-z0-9-]+\.)+(?:net|com|org|io|dev))['"]/gi,
      /https?:\/\/((?:[a-z0-9-]+\.)+(?:net|com|org|io|dev))/gi,
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      const allowed = new Set(['app.bombfarm.net', ...(file === MARKET_TRANSPORT_FILE ? [MARKET_SNAPSHOT_HOST] : [])]);
      for (const pattern of hostPatterns) {
        const re = new RegExp(pattern);
        let match: RegExpExecArray | null;
        while ((match = re.exec(text))) {
          const host = match[1];
          if (host && !allowed.has(host.toLowerCase())) {
            offenders.push(`${file}: ${host}`);
          }
        }
      }
    }
    expect(offenders, `Only app.bombfarm.net is allowed. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('red state demonstrated: a host named inside a URL literal is caught', () => {
    const pattern = /https?:\/\/((?:[a-z0-9-]+\.)+(?:net|com|org|io|dev))/gi;
    expect(pattern.exec("const endpoint = 'https://elsewhere.example.com/collect';")?.[1]).toBe('elsewhere.example.com');
  });

  it('the market transport names one host and sets no HTTP method at all, so it can only ever GET', () => {
    const text = readFileSync(MARKET_TRANSPORT_FILE, 'utf8');
    expect(text, 'sanity: the market transport must name the snapshot host it reads').toContain(MARKET_SNAPSHOT_HOST);
    expect(/\bmethod\s*:/.test(foldStringConcatenation(text)), 'the market transport must never set a method').toBe(false);
  });

  it('contains no dotted-quad IP literal (no Cloudflare fixed-IP fallback)', () => {
    // Negative lookahead excludes the game build string '0.1.0.0+2026-08-11T21:38:23Z'
    // (fingerprints.ts) — semver build metadata, not an IP; a real IP is never followed by '+'.
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b(?!\+)/;
    const offenders = sourceFiles
      .map((file) => ({ file, match: ipPattern.exec(readFileSync(file, 'utf8')) }))
      .filter((r) => r.match !== null && !LOOPBACK_IPS.has(r.match[0]));
    expect(offenders, `No IP fallback. Offenders: ${JSON.stringify(offenders.map((o) => o.file))}`).toEqual([]);
  });

  it('https-transport.ts forwards HttpRequest.method verbatim in every https.request call — no literal, template, or computed method value of its own', () => {
    // Closes the "computed value" half of the obfuscation class: rather than trying to
    // evaluate an arbitrary expression (`String.fromCharCode(...)`, a reassigned variable, a
    // ternary, ...), this simply forbids the one file that owns the socket from doing anything
    // except forwarding the compile-time-literal-typed `req.method` it was handed.
    //
    // Scans EVERY `https.request({...},` occurrence, not just the first (fix-loop-2: a fresh
    // Verifier's PoC placed a second, covert `https.request(...)` call *after* the legitimate
    // one, using a computed method (`String.fromCharCode(80, 79, 83, 84)`) that a non-global
    // `.exec()` — which only ever sees the first match — never inspected; the literal-verb scan
    // above missed it too, since a computed value has no quoted substring to find). Also asserts
    // every `https.request(` call in the file is inline-object-shaped, so a call passed a
    // pre-built options variable (which would smuggle a method value in a form this regex
    // can't read at all) can't slip through by count alone.
    const text = readFileSync(HTTPS_TRANSPORT_FILE, 'utf8');
    const totalCalls = (text.match(/https\.request\(/g) ?? []).length;
    expect(totalCalls, 'sanity: https-transport.ts must call https.request at least once').toBeGreaterThan(0);

    const optionsBlockPattern = /https\.request\(\s*\{([\s\S]*?)\}\s*,/g;
    const optionsBlocks: string[] = [];
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = optionsBlockPattern.exec(text))) {
      optionsBlocks.push(blockMatch[1] ?? '');
    }
    expect(
      optionsBlocks.length,
      `https-transport.ts must build every https.request call's options inline so this guard can read the method field — found ${String(totalCalls)} call(s) but only ${String(optionsBlocks.length)} inline options block(s)`,
    ).toBe(totalCalls);

    optionsBlocks.forEach((optionsBlock, index) => {
      const methodFieldMatch = /\bmethod\s*:\s*([^,\n}]+)/.exec(optionsBlock);
      expect(methodFieldMatch, `https-transport.ts call #${String(index + 1)} must set an explicit method field on its https.request options`).not.toBeNull();
      const methodValue = methodFieldMatch?.[1]?.trim();
      expect(methodValue, `https-transport.ts call #${String(index + 1)} must forward req.method verbatim, got "${String(methodValue)}"`).toBe('req.method');
    });
  });
});

// -------------------------------------------------------------------------------------------
// Guard 2 — one socket. Only https-transport.ts may import a transport library.
// -------------------------------------------------------------------------------------------

describe('Guard 2 — https-transport.ts is the sole transport-library importer', () => {
  // Explicit, minimal allow-list: electron-updater's own GitHub calls and renderer/** are out of
  // scope for this guard (they are not on the account-read path this feature owns).
  const scannedFiles = [...walkTsFiles(GAME_API_SRC), ...walkTsFiles(DESKTOP_MAIN)].filter((f) => !isTestFile(f));

  it('scans a non-empty set of non-test source files', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it('no module outside the two transports imports node:https, node:http, undici, axios or names fetch(', () => {
    // Covers a static `from '...'`, a CommonJS `require(...)`, AND a dynamic `import(...)` —
    // the last was missing until the fix-loop-2 Verifier reproduced the original report's "one
    // socket" PoC verbatim (`const https = await import('node:https'); https.request(...)`),
    // which this pattern's static-only shape let straight through with 21/21 tests still green.
    const importPattern =
      /(?:from\s+['"](node:https|node:http|undici|axios)['"]|require\(\s*['"](node:https|node:http|undici|axios)['"]\s*\)|import\(\s*['"](node:https|node:http|undici|axios)['"]\s*\))/;
    const fetchPattern = /\bfetch\s*\(/;
    const offenders: string[] = [];
    for (const file of scannedFiles) {
      if (file === HTTPS_TRANSPORT_FILE || file === MARKET_TRANSPORT_FILE) continue;
      const text = readFileSync(file, 'utf8');
      if (importPattern.test(text) || fetchPattern.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `https-transport.ts is the only socket. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('https-transport.ts itself does import node:https (sanity — the guard is not vacuous)', () => {
    const text = readFileSync(HTTPS_TRANSPORT_FILE, 'utf8');
    expect(text).toMatch(/from ['"]node:https['"]/);
  });

  it('market-transport.ts itself does reach the network (sanity — its exemption is not vacuous)', () => {
    const text = readFileSync(MARKET_TRANSPORT_FILE, 'utf8');
    expect(text).toMatch(/\bfetch\s*\(/);
  });

  it('nothing outside market-transport.ts names the market snapshot URL constant', () => {
    const offenders = scannedFiles.filter(
      (file) => file !== MARKET_TRANSPORT_FILE && readFileSync(file, 'utf8').includes(MARKET_SNAPSHOT_HOST),
    );
    expect(offenders, `Only market-transport.ts names the snapshot host. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// Guard 3 — no unconsented path.
// -------------------------------------------------------------------------------------------

describe('Guard 3 — no path to the network or the token file bypasses consent', () => {
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
    expect(offenders, `Only session-token-file.ts opens the token file's directory. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('the token is dereferenced via [RAW] only in request.ts among non-test files', () => {
    const derefPattern = /\.token\[RAW\]/;
    const offenders = nonTestFiles.filter((file) => file !== REQUEST_FILE && derefPattern.test(readFileSync(file, 'utf8')));
    expect(offenders, `request.ts is the only reader of the raw token. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
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
    expect(offenders, `Every network call site must be typed to a ConsentedSession. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('sanity: at least one file does call requestGet/readSection (the guard above is not vacuous)', () => {
    const callers = nonTestFiles.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /\brequestGet\(/.test(text) || /\breadSection\(/.test(text);
    });
    expect(callers.length).toBeGreaterThan(0);
  });

  it('every caller of requestPost() is typed to a WriteSession — the same rule as requestGet() → ConsentedSession', () => {
    const offenders = nonTestFiles.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /\brequestPost\(/.test(text) && !text.includes('WriteSession');
    });
    expect(offenders, `Every write call site must be typed to a WriteSession. Offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('forge-request.ts is the only definer of requestPost(), and its caller set is empty — nothing in the app forges yet; the Forge tab is the change that flips this', () => {
    const definers = nonTestFiles.filter((file) => /export async function requestPost\(/.test(readFileSync(file, 'utf8')));
    expect(definers).toEqual([FORGE_REQUEST_FILE]);

    const callers = nonTestFiles.filter((file) => file !== FORGE_REQUEST_FILE && /\brequestPost\(/.test(readFileSync(file, 'utf8')));
    expect(callers).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// Guard 4 — the account path never reaches the live tap. The account's only
// legitimate source is the authenticated route this file itself drives (`readSection`/
// `assembleAccountPayload`); the live tap (`live-source/`) reads intercepted traffic outside
// that route, and — same as the OS-level memory read it replaced — must never become a second,
// unconsented producer of account data. `AccountCommitter` is imported `import type` from
// `game-reader-service.ts` for exactly this reason: it is erased at compile time, so it cannot
// smuggle in a runtime edge to the tap. This guard proves that stays true.
// -------------------------------------------------------------------------------------------

// Trailing slash deliberately: `packages/contracts/src/live-source.ts` (the pure type/helper
// module every runtime import of `@bombfarm/contracts` can legitimately reach) happens to share
// its filename with this directory. A bare `live-source` marker would flag that unrelated file's
// own `./live-source.js` specifier; the slash only matches a path that names this directory.
const FORBIDDEN_MODULE_MARKERS = ['live-source/'];
const FORBIDDEN_NAMES = ['LiveSource'];

/**
 * A fully `import type { ... } from '...'` or `export type { ... } from '...'` statement is
 * erased at compile time — it cannot smuggle in a runtime dependency, so both are deliberately
 * excluded here (this is exactly the shape `account-refresh.ts` uses to reuse
 * `game-reader-service.ts`'s `AccountCommitter` interface without ever importing the live tap's
 * module at runtime).
 *
 * Covers four value-level edge shapes (T-fix-3): a static `import ... from`, a re-export chain
 * (`export { X [as Y] } from '...'` / `export * from '...'`) — the exact shape a Verifier used to
 * defeat this walker (`export { pickHighestGoldCandidate as legacyGoldPicker } from
 * '@bombfarm/game-data'` wired into `account-refresh.ts` was invisible to the old, import-only
 * regex, back when this guard's forbidden names still named the process-memory reader this app no
 * longer has) — a dynamic `import('...')` with a static string argument, and a CommonJS
 * `require(...)`. A computed/templated specifier in either of the last two cannot be resolved
 * statically and is out of scope, the same way every other guard in this file only defeats
 * syntactic, not arbitrary-runtime-value, obfuscation.
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

  const reExportRegex = /export\s+(type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(text))) {
    const isTypeOnly = Boolean(match[1]);
    const specifier = match[2];
    if (!specifier || isTypeOnly) continue;
    specifiers.push(specifier);
  }

  const dynamicImportRegex = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(text))) {
    const specifier = match[1];
    if (specifier) specifiers.push(specifier);
  }

  const requireRegex = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(text))) {
    const specifier = match[1];
    if (specifier) specifiers.push(specifier);
  }

  return specifiers;
}

/** Extracts the imported/re-exported names bound to a given `specifier`, across every value-edge
 *  shape `parseImportSpecifiers` recognizes above (static import, re-export chain, or a
 *  destructured dynamic import). For an `X as Y` clause this returns `X` — the name the source
 *  module actually defines — since that is what `FORBIDDEN_NAMES` matches against, not the local
 *  alias a re-export or renamed import gives it. */
function importedNamesFrom(text: string, specifier: string): string[] {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"]${escaped}['"]`),
    new RegExp(`export\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"]${escaped}['"]`),
    new RegExp(`\\{([^}]*)\\}\\s*=\\s*(?:await\\s+)?import\\(\\s*['"]${escaped}['"]\\s*\\)`),
  ];

  const names: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    for (const clause of match[1].split(',')) {
      const name = clause.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) names.push(name);
    }
  }
  return names;
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

const WORKSPACE_PACKAGES_DIR = join(REPO_ROOT, 'packages');

/**
 * Resolves a bare `@bombfarm/<name>` specifier to that workspace package's own source entry
 * point (`packages/<name>/src/index.ts`) — deliberately `src`, never `dist`, same as every other
 * file this guard reads (see the file header). Closes the gap a fresh Verifier reproduced live: a
 * forbidden name re-exported under an alias *inside a different workspace package*
 * (`packages/game-data/src/index.ts`) was invisible to the walker because it only ever recursed
 * into `specifier.startsWith('.')` — a bare package specifier like `@bombfarm/game-data` was
 * checked against `FORBIDDEN_NAMES`/`FORBIDDEN_MODULE_MARKERS` using only the *importing* file's
 * own import clause text, and the target package's own re-export line was simply never read. Any
 * specifier that isn't a `@bombfarm/*` workspace package (a real npm dependency, `node:*`, ...) is
 * left unresolved, same as before — this guard has no reason to walk into `node_modules`.
 */
function resolveWorkspaceImport(specifier: string): string | null {
  const match = /^@bombfarm\/([^/]+)$/.exec(specifier);
  const packageName = match?.[1];
  if (!packageName) return null;
  const candidate = join(WORKSPACE_PACKAGES_DIR, packageName, 'src', 'index.ts');
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
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
      } else {
        const resolved = resolveWorkspaceImport(specifier);
        if (resolved) queue.push(resolved);
      }
    }
  }

  return { violations, visited };
}

describe('Guard 4 parser — the new edge shapes it walks, and the type-only edges it still excludes (T-fix-3)', () => {
  it('follows a re-export chain (export { X as Y } from "...") as a value edge, matching on the original name', () => {
    const text = "export { LiveSource as liveSourceAlias } from '../live-source/live-source.js';";
    expect(parseImportSpecifiers(text)).toEqual(['../live-source/live-source.js']);
    expect(importedNamesFrom(text, '../live-source/live-source.js')).toEqual(['LiveSource']);
  });

  it('excludes an `export type { ... } from` re-export — erased at compile time, same as `import type`', () => {
    const text = "export type { AccountCommitter } from '../game-reader/game-reader-service.js';";
    expect(parseImportSpecifiers(text)).toEqual([]);
  });

  it('still excludes a plain `import type { ... } from` (regression guard for the existing correct behaviour)', () => {
    const text = "import type { AccountCommitter } from '../game-reader/game-reader-service.js';";
    expect(parseImportSpecifiers(text)).toEqual([]);
  });

  it('follows a dynamic import() with a static string argument', () => {
    const text = "const mod = await import('../live-source/live-source.js');";
    expect(parseImportSpecifiers(text)).toEqual(['../live-source/live-source.js']);
  });

  it('extracts a forbidden name destructured directly off a dynamic import()', () => {
    const text = "const { LiveSource } = await import('../live-source/live-source.js');";
    expect(importedNamesFrom(text, '../live-source/live-source.js')).toEqual(['LiveSource']);
  });

  it('follows a require(...) call', () => {
    const text = "const mod = require('../live-source/live-source.js');";
    expect(parseImportSpecifiers(text)).toEqual(['../live-source/live-source.js']);
  });

  it('resolveWorkspaceImport resolves a bare @bombfarm/<name> specifier to that package\'s own src/index.ts', () => {
    expect(resolveWorkspaceImport('@bombfarm/game-data')).toBe(join(WORKSPACE_PACKAGES_DIR, 'game-data', 'src', 'index.ts'));
  });

  it('resolveWorkspaceImport does not resolve a non-workspace or scoped-subpath specifier', () => {
    expect(resolveWorkspaceImport('node:https')).toBeNull();
    expect(resolveWorkspaceImport('electron')).toBeNull();
    expect(resolveWorkspaceImport('@bombfarm/does-not-exist')).toBeNull();
  });
});

describe('Guard 4 — the account path never reaches the live tap', () => {
  const { violations, visited } = walkImportGraph(ACCOUNT_REFRESH_FILE);

  it('walked a non-empty import graph from account-refresh.ts', () => {
    expect(visited.size).toBeGreaterThan(0);
    expect(visited.has(ACCOUNT_REFRESH_FILE)).toBe(true);
  });

  it('reaches no edge into live-source/ or its LiveSource class', () => {
    expect(
      violations,
      `The account is never sourced from the live tap, in this feature or as a fallback. Violations: ${JSON.stringify(violations)}`,
    ).toEqual([]);
  });
});
