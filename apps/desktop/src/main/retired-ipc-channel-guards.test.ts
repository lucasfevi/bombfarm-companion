/**
 * The live screen replaces the developer Diagnostics tab and its raw-payload dump, and retires
 * the two IPC channels that fed it (`game:getSnapshot`, `snapshot:updated`) rather than
 * repurposing them. This guard is the executable form of "retired, not repurposed": neither
 * channel name may reappear anywhere in the tracked main, preload, contracts, or renderer source.
 *
 * `walk`/`readAll` come from `guard-scan.ts`, shared with the other guards in this folder.
 * `stripComments` stays local — see that module's note on why it is the one piece not shared.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type FileEntry, guardScanner } from './guard-scan';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const CONTRACTS_ROOT = resolve(DESKTOP_ROOT, '..', '..', 'packages', 'contracts', 'src');
/** This guard file's own path — excluded from every scan below. Its "red state demonstrated"
 *  test deliberately contains the retired names as a plain JS string literal (a fixture), which
 *  would otherwise flag the guard against itself. `__filename`, not `import.meta.url`: this file
 *  is also picked up by `tsconfig.main.json`'s CommonJS build. */
const SELF_PATH = __filename;

const { readAll } = guardScanner(SELF_PATH);

/** This guard scans tests too — a retired channel name may not reappear in a spec either. */
const INCLUDING_TESTS = { includeTests: true } as const;

/** Strips `//` line comments and `/* *\/` block comments (dumb text slicing, not a full parser —
 *  the repo's own established convention, per `source-guards.test.ts`). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ALL_SOURCE = (): FileEntry[] => [
  ...readAll(DESKTOP_ROOT, ['.ts', '.tsx', '.mjs'], INCLUDING_TESTS),
  ...readAll(CONTRACTS_ROOT, ['.ts'], INCLUDING_TESTS),
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
