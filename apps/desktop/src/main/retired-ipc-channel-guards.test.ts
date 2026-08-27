/**
 * The live screen replaces the developer Diagnostics tab and its raw-payload dump, and retires
 * the two IPC channels that fed it (`game:getSnapshot`, `snapshot:updated`) rather than
 * repurposing them. This guard is the executable form of "retired, not repurposed": neither
 * channel name may reappear anywhere in the tracked main, preload, contracts, or renderer source.
 *
 * `walk`/`readAll`/`stripComments`/`SELF_PATH` are reproduced from `planning-guards.test.ts`'s own
 * copy (not imported — that file exports nothing, by the same convention this one follows), same
 * reasoning: each guard file owns its scan.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const CONTRACTS_ROOT = resolve(DESKTOP_ROOT, '..', '..', 'packages', 'contracts', 'src');
/** This guard file's own path — excluded from every scan below. Its "red state demonstrated"
 *  test deliberately contains the retired names as a plain JS string literal (a fixture), which
 *  would otherwise flag the guard against itself. `__filename`, not `import.meta.url`: this file
 *  is also picked up by `tsconfig.main.json`'s CommonJS build. */
const SELF_PATH = __filename;

type FileEntry = { path: string; source: string };

function walk(dir: string, extensions: readonly string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'out' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === '.next-dev' ||
        entry.name === '.claude'
      )
        continue;
      files.push(...walk(full, extensions));
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function readAll(dir: string, extensions: readonly string[]): FileEntry[] {
  return walk(dir, extensions)
    .filter((path) => path !== SELF_PATH)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }));
}

/** Strips `//` line comments and `/* *\/` block comments (dumb text slicing, not a full parser —
 *  the repo's own established convention, per `planning-guards.test.ts`). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ALL_SOURCE = () => [
  ...readAll(DESKTOP_ROOT, ['.ts', '.tsx', '.mjs']),
  ...readAll(CONTRACTS_ROOT, ['.ts']),
];

describe('game:getSnapshot and snapshot:updated are retired, not repurposed', () => {
  const patterns: [string, RegExp][] = [
    ['game:getSnapshot', /\bgame:getSnapshot\b/],
    ['snapshot:updated', /\bsnapshot:updated\b/],
  ];

  for (const [name, pattern] of patterns) {
    it(`zero occurrences of "${name}" across main, preload, contracts, and renderer`, () => {
      const offenders = ALL_SOURCE()
        .filter((file) => pattern.test(stripComments(file.source)))
        .map((file) => file.path);
      expect(
        offenders,
        `Found "${name}" in: ${offenders.join(', ')}. This channel was retired along with the ` +
          `Diagnostics tab it fed — it must never come back, under any name reuse or new handler.`,
      ).toEqual([]);
    });
  }

  it('red state demonstrated: a temporary game:getSnapshot reference is caught', () => {
    const fixtureSource = "bridge.invoke('game:getSnapshot')";
    expect(/\bgame:getSnapshot\b/.test(stripComments(fixtureSource))).toBe(true);
  });

  it('red state demonstrated: a temporary snapshot:updated reference is caught', () => {
    const fixtureSource = "bridge.on('snapshot:updated', handler)";
    expect(/\bsnapshot:updated\b/.test(stripComments(fixtureSource))).toBe(true);
  });
});
