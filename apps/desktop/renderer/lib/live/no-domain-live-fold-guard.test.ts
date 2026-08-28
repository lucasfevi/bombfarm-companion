/**
 * The Live screen's countdown fold (the drain-rate fit over a sliding sample window) is computed
 * once, in the main process, and sent to the renderer as a finished value — never refolded from
 * raw frames in the renderer, which would restart the fit on every mount and misreport an
 * `observed` reading as `modelled` for a window afterward. This guard is the executable form of
 * that constraint: `@bombfarm/domain/live` (the module the fold lives in) must never be imported
 * anywhere under the renderer tree again.
 *
 * `walk`/`readAll`/`stripComments`/`SELF_PATH` follow `retired-ipc-channel-guards.test.ts`'s own
 * copy of the same helpers (not imported — each guard file owns its scan, by that file's own
 * stated convention).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER_ROOT = resolve(__dirname, '..', '..');
/** `__filename`, not `import.meta.url`: this file is also picked up by the desktop project's
 *  CommonJS-targeting build config. Its "red state demonstrated" test deliberately contains the
 *  forbidden import as a plain string literal (a fixture), which would otherwise flag the guard
 *  against itself. */
const SELF_PATH = __filename;

type FileEntry = { path: string; source: string };

function walk(dir: string, extensions: readonly string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === '.next') continue;
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

/** Strips `//` line comments and `/* *\/` block comments — dumb text slicing, not a full parser,
 *  the repo's own established convention for this style of guard. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const FORBIDDEN_PATTERN = /@bombfarm\/domain\/live\b/;

describe('the renderer never re-folds the field-countdown drain rate', () => {
  it('zero imports of @bombfarm/domain/live anywhere under the renderer tree', () => {
    const offenders = readAll(RENDERER_ROOT, ['.ts', '.tsx'])
      .filter((file) => FORBIDDEN_PATTERN.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(
      offenders,
      `Found an @bombfarm/domain/live import in: ${offenders.join(', ')}. Field and recovery ` +
        'countdowns are computed once, in the main process, and sent to the renderer as a ' +
        'finished value — refolding them here is exactly the divergence this guard exists to catch.',
    ).toEqual([]);
  });

  it('red state demonstrated: a temporary @bombfarm/domain/live import is caught', () => {
    const fixtureSource = "import { ingestFieldCountdownTick } from '@bombfarm/domain/live';";
    expect(FORBIDDEN_PATTERN.test(stripComments(fixtureSource))).toBe(true);
  });
});
