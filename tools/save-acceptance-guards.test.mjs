/**
 * (T7) — source guards for the positive acceptance gate.
 *
 * Three independent hard-zero checks, each comment-stripped (this repo's established convention
 * — `apps/desktop/src/main/planning-guards.test.ts`'s `stripComments`) so a doc comment naming a
 * forbidden token to explain why it is forbidden does not trip the guard against itself:
 *
 *   1. No acceptance-path file (`save-schema.ts`, `import-save.ts`) reads a retired keystone
 *      token — the discriminator is positive-only, never `!has(oldKey)`.
 *   2. Neither file reads `export_version` as a signal — it was `1` before the 2026-08-13 patch
 *      and `1` after, so it is not a discriminator.
 *   3. `apps/desktop/**` never imports `parseSaveFile` — the gate is web-only by construction,
 *      not by convention; the desktop imports `parseAccountPayload` only.
 *
 * Home: `tools/`, reading `packages/domain/src` and `apps/desktop` as plain text — no new files
 * added to either package for this guard (matches
 * `tools/advisor-input-parity.test.mjs`'s own shape).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SAVE_SCHEMA_PATH = join(root, 'packages/domain/src/save-schema.ts');
const IMPORT_SAVE_PATH = join(root, 'packages/domain/src/import-save.ts');
const DESKTOP_ROOT = join(root, 'apps/desktop');

/** Strips `//` line comments and `/* *\/` block comments — dumb text slicing, this repo's own
 *  established convention (`planning-guards.test.ts`'s `stripComments`), not a full parser. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function readStripped(path) {
  return stripComments(readFileSync(path, 'utf8'));
}

function walk(dir, extensions, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'dist' || entry.name === '.next') {
        continue;
      }
      walk(join(dir, entry.name), extensions, acc);
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

const KEYSTONE_TOKEN_PATTERN = /keystone|abisso|glass.?cannon|tempo.?dobrado|crit_dmg_mult|abissoBase|abisso_base/i;

/**
 * Forbids READING `export_version` as a signal — property access or a comparison — not
 * merely NAMING it. `save-schema.ts` legitimately declares `'export_version'` as a bare string
 * element of the export's top-level `keys` array (the export schema's own acceptance criteria
 * require it to cover the file's real top level, of which `export_version` is one key); that is a schema
 * declaration, never a read. Matches `raw.export_version`, `payload.export_version`,
 * `export_version ===`/`!==`/`==`/`!=`, and `'export_version' in raw` — never a bare array-literal
 * element.
 */
const EXPORT_VERSION_READ_PATTERN = /\.export_version\b|\bexport_version\s*(===|!==|==|!=)|['"]export_version['"]\s+in\s/;

describe('save-acceptance-guards — the positive acceptance gate stays positive (T7)', () => {
  describe('no retired keystone token in the acceptance path', () => {
    it('save-schema.ts names no retired keystone token', () => {
      expect(KEYSTONE_TOKEN_PATTERN.test(readStripped(SAVE_SCHEMA_PATH))).toBe(false);
    });

    it('import-save.ts names no retired keystone token', () => {
      expect(KEYSTONE_TOKEN_PATTERN.test(readStripped(IMPORT_SAVE_PATH))).toBe(false);
    });

    it('red state demonstrated: a fixture line containing "abisso_base" is caught', () => {
      const fixtureSource = 'if (totals.abisso_base === 0) return true;';
      expect(KEYSTONE_TOKEN_PATTERN.test(stripComments(fixtureSource))).toBe(true);
    });
  });

  describe('export_version is never read as an acceptance signal', () => {
    it('save-schema.ts does not read export_version', () => {
      expect(EXPORT_VERSION_READ_PATTERN.test(readStripped(SAVE_SCHEMA_PATH))).toBe(false);
    });

    it('import-save.ts does not read export_version', () => {
      expect(EXPORT_VERSION_READ_PATTERN.test(readStripped(IMPORT_SAVE_PATH))).toBe(false);
    });

    it('red state demonstrated: a fixture line reading raw.export_version is caught', () => {
      const fixtureSource = 'if (raw.export_version === 1) accept();';
      expect(EXPORT_VERSION_READ_PATTERN.test(stripComments(fixtureSource))).toBe(true);
    });
  });

  describe('apps/desktop never imports parseSaveFile', () => {
    const desktopSourceFiles = walk(DESKTOP_ROOT, ['.ts', '.tsx']);

    it('non-vacuity: the desktop source scan is non-empty', () => {
      expect(desktopSourceFiles.length).toBeGreaterThan(50);
    });

    it('zero occurrences of parseSaveFile anywhere under apps/desktop (source and tests)', () => {
      const offenders = desktopSourceFiles
        .filter((path) => /\bparseSaveFile\b/.test(readStripped(path)))
        .map((path) => path.slice(root.length + 1).replace(/\\/g, '/'));
      expect(
        offenders,
        `Found parseSaveFile referenced under apps/desktop in: ${offenders.join(', ')}. The ` +
          'desktop imports parseAccountPayload only (measured) — parseSaveFile\'s gate is ' +
          'web-only and must stay unreachable from the desktop.',
      ).toEqual([]);
    });

    it('red state demonstrated: a fixture importing parseSaveFile is caught', () => {
      const fixtureSource = "import { parseSaveFile } from '@bombfarm/domain/import-save';";
      expect(/\bparseSaveFile\b/.test(stripComments(fixtureSource))).toBe(true);
    });
  });
});
