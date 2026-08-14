import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { fingerprintPayload, serializeBaseline } from './wiki-drift/fingerprint.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CHECK_PATH = join(root, 'wiki-drift/check.mjs');
const FIXTURES = join(root, 'wiki-drift/__fixtures__');
const DATA_FIXTURE = join(FIXTURES, 'api-data.captured.json');
const FASES_NOMES_FIXTURE = join(FIXTURES, 'fases-nomes.captured.json');

const DATA_URL = 'https://wiki.bombfarm.net/wiki/api/data';
const FASES_NOMES_URL = 'https://wiki.bombfarm.net/wiki/api/fases-nomes';

const apiDataCapture = JSON.parse(readFileSync(DATA_FIXTURE, 'utf8'));
const fasesNomesCapture = JSON.parse(readFileSync(FASES_NOMES_FIXTURE, 'utf8'));

const FIXED_NOW = '2026-08-14T05:17:00.000Z';

const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'wiki-drift-cli-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

function validScratchBaselinePath(dir) {
  const baseline = {
    schemaVersion: 1,
    capturedAt: FIXED_NOW,
    endpoints: {
      data: fingerprintPayload(DATA_URL, apiDataCapture),
      fasesNomes: fingerprintPayload(FASES_NOMES_URL, fasesNomesCapture),
    },
  };
  const path = join(dir, 'scratch-baseline.json');
  writeFileSync(path, serializeBaseline(baseline));
  return path;
}

/**
 * Writes a stub ports module into `dir` that fetches from the real fixture files on disk
 * (never the network) and logs every call to `dir/calls.log` as one JSON line per call, so the
 * parent test process can assert on network activity across the spawned child process boundary.
 *
 * `dataHandler`/`fasesNomesHandler`/`githubHandler` each receive the parsed fixture (or null for
 * github) and return `{ status, body }`; omit to serve the fixture unmodified with status 200.
 */
function writeStubPortsModule(dir, { dataHandler, fasesNomesHandler, githubHandler } = {}) {
  const path = join(dir, 'stub-ports.mjs');
  const callLog = join(dir, 'calls.log');
  const source = `
import { appendFileSync, readFileSync } from 'node:fs';

const DATA_FIXTURE = ${JSON.stringify(DATA_FIXTURE)};
const FASES_NOMES_FIXTURE = ${JSON.stringify(FASES_NOMES_FIXTURE)};
const CALL_LOG = ${JSON.stringify(callLog)};
const DATA_URL = ${JSON.stringify(DATA_URL)};
const FASES_NOMES_URL = ${JSON.stringify(FASES_NOMES_URL)};

function logCall(url, options) {
  appendFileSync(CALL_LOG, JSON.stringify({ url, method: options?.method ?? 'GET' }) + '\\n');
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const dataHandler = ${dataHandler ?? 'null'};
const fasesNomesHandler = ${fasesNomesHandler ?? 'null'};
const githubHandler = ${githubHandler ?? 'null'};

export async function fetchImpl(url, options) {
  logCall(url, options);
  if (url === DATA_URL) {
    const capture = JSON.parse(readFileSync(DATA_FIXTURE, 'utf8'));
    if (dataHandler) return dataHandler(capture);
    return jsonResponse(200, capture);
  }
  if (url === FASES_NOMES_URL) {
    const capture = JSON.parse(readFileSync(FASES_NOMES_FIXTURE, 'utf8'));
    if (fasesNomesHandler) return fasesNomesHandler(capture);
    return jsonResponse(200, capture);
  }
  if (url.startsWith('https://api.github.com/')) {
    if (githubHandler) return githubHandler(url, options);
    if ((options?.method ?? 'GET') === 'GET') return jsonResponse(200, []);
    return jsonResponse(201, { number: 1, html_url: 'https://example.invalid/issues/1' });
  }
  throw new Error('stub-ports: unexpected url ' + url);
}

export async function sleep() {
  // No real delay in tests — retries happen instantly.
}

export function now() {
  return ${JSON.stringify(FIXED_NOW)};
}
`;
  writeFileSync(path, source);
  return { modulePath: path, callLogPath: callLog };
}

function readCallLog(callLogPath) {
  if (!existsSync(callLogPath)) return [];
  return readFileSync(callLogPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runCli({ dir, baselinePath, portsModulePath, args = [], env = {} }) {
  const result = spawnSync(process.execPath, [CHECK_PATH, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      WIKI_DRIFT_BASELINE_PATH: baselinePath,
      WIKI_DRIFT_TEST_PORTS_MODULE: portsModulePath,
      ...env,
    },
  });
  return result;
}

describe('check.mjs — exit codes at the process boundary (MWD-27, MWD-37, AD-093)', () => {
  it('ok → exit 0', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath } = writeStubPortsModule(dir);
    const result = runCli({ dir, baselinePath, portsModulePath: modulePath });
    expect(result.stdout).toMatch(/^outcome: ok$/m);
    expect(result.status).toBe(0);
  });

  it('drift → exit 1', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath } = writeStubPortsModule(dir, {
      dataHandler: 'function (capture) { const mutated = { ...capture, gemas: { ...capture.gemas, __probe: 1 } }; return { ok: true, status: 200, json: async () => mutated }; }',
    });
    const result = runCli({ dir, baselinePath, portsModulePath: modulePath });
    expect(result.stdout).toMatch(/^outcome: drift$/m);
    expect(result.status).toBe(1);
  });

  it('unreachable → exit 2', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath } = writeStubPortsModule(dir, {
      dataHandler: 'function () { return { ok: false, status: 500, json: async () => ({}) }; }',
    });
    const result = runCli({ dir, baselinePath, portsModulePath: modulePath });
    expect(result.stdout).toMatch(/^outcome: unreachable$/m);
    expect(result.status).toBe(2);
  });

  it('baseline-missing → exit 3, and no request is ever made (stage order, AD-093)', () => {
    const dir = makeTempDir();
    const missingBaselinePath = join(dir, 'does-not-exist.json');
    const { modulePath, callLogPath } = writeStubPortsModule(dir);
    const result = runCli({ dir, baselinePath: missingBaselinePath, portsModulePath: modulePath });
    expect(result.stdout).toMatch(/^outcome: baseline-missing$/m);
    expect(result.status).toBe(3);
    expect(readCallLog(callLogPath)).toEqual([]);
  });
});

describe('check.mjs — ok creates no issue, comments on none (MWD-07)', () => {
  it('zero api.github.com calls on a clean run', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath, callLogPath } = writeStubPortsModule(dir);
    const result = runCli({
      dir,
      baselinePath,
      portsModulePath: modulePath,
      env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'o/r' },
    });
    expect(result.status).toBe(0);
    const githubCalls = readCallLog(callLogPath).filter((c) => c.url.includes('api.github.com'));
    expect(githubCalls).toEqual([]);
  });
});

describe('check.mjs — drift also exits non-zero, both channels in the same case (MWD-21)', () => {
  it('drift with a working issue API ⇒ exit 1 AND an issue call is made', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath, callLogPath } = writeStubPortsModule(dir, {
      dataHandler: 'function (capture) { const mutated = { ...capture, gemas: { ...capture.gemas, __probe: 1 } }; return { ok: true, status: 200, json: async () => mutated }; }',
    });
    const result = runCli({
      dir,
      baselinePath,
      portsModulePath: modulePath,
      env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'o/r' },
    });
    expect(result.status).toBe(1);
    const githubCalls = readCallLog(callLogPath).filter((c) => c.url.includes('api.github.com'));
    expect(githubCalls.length).toBeGreaterThan(0);
  });
});

describe('check.mjs — an issue-API failure still exits non-zero and says so (MWD-23)', () => {
  it('drift + a failing issue API ⇒ still exit 1, summary says the alert could not be filed', () => {
    const dir = makeTempDir();
    const baselinePath = validScratchBaselinePath(dir);
    const { modulePath } = writeStubPortsModule(dir, {
      dataHandler: 'function (capture) { const mutated = { ...capture, gemas: { ...capture.gemas, __probe: 1 } }; return { ok: true, status: 200, json: async () => mutated }; }',
      githubHandler: 'function () { return { ok: false, status: 500, json: async () => ({}) }; }',
    });
    const result = runCli({
      dir,
      baselinePath,
      portsModulePath: modulePath,
      env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'o/r' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/could not be filed/i);
  });
});

describe('check.mjs --write (MWD-35, MWD-36, MWD-37)', () => {
  it('fetches, fingerprints and rewrites only the given baseline path — no other change, no issue', () => {
    const dir = makeTempDir();
    const baselinePath = join(dir, 'scratch-write.json');
    const { modulePath, callLogPath } = writeStubPortsModule(dir);
    const result = runCli({
      dir,
      baselinePath,
      portsModulePath: modulePath,
      args: ['--write'],
      env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'o/r' },
    });
    expect(result.status).toBe(0);
    expect(existsSync(baselinePath)).toBe(true);
    const githubCalls = readCallLog(callLogPath).filter((c) => c.url.includes('api.github.com'));
    expect(githubCalls).toEqual([]);
  });

  it('run twice against the same payload ⇒ byte-identical output (MWD-36)', () => {
    const dir = makeTempDir();
    const baselinePath = join(dir, 'scratch-write.json');
    const { modulePath } = writeStubPortsModule(dir);

    const first = runCli({ dir, baselinePath, portsModulePath: modulePath, args: ['--write'] });
    expect(first.status).toBe(0);
    const firstBytes = readFileSync(baselinePath, 'utf8');

    const second = runCli({ dir, baselinePath, portsModulePath: modulePath, args: ['--write'] });
    expect(second.status).toBe(0);
    const secondBytes = readFileSync(baselinePath, 'utf8');

    expect(secondBytes).toBe(firstBytes);
  });

  it('a written baseline is then read as ok by a plain run against the same fixtures', () => {
    const dir = makeTempDir();
    const baselinePath = join(dir, 'scratch-write.json');
    const { modulePath } = writeStubPortsModule(dir);
    runCli({ dir, baselinePath, portsModulePath: modulePath, args: ['--write'] });
    const readBack = runCli({ dir, baselinePath, portsModulePath: modulePath });
    expect(readBack.stdout).toMatch(/^outcome: ok$/m);
    expect(readBack.status).toBe(0);
  });
});

describe('tools/wiki-drift/*.mjs — every import specifier starts node: or ./', () => {
  it('zero third-party import specifiers across the module set', () => {
    const files = ['fingerprint.mjs', 'fetch-endpoints.mjs', 'report.mjs', 'issue.mjs', 'check.mjs'];
    for (const file of files) {
      const source = readFileSync(join(root, 'wiki-drift', file), 'utf8');
      const specifiers = [...source.matchAll(/^import .* from ['"]([^'"]+)['"];?$/gm)].map((m) => m[1]);
      const offenders = specifiers.filter((s) => !s.startsWith('node:') && !s.startsWith('./'));
      expect(offenders, `${file}: ${offenders.join(', ')}`).toEqual([]);
    }
  });
});
