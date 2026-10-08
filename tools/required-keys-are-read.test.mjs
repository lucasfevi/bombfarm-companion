/**
 * A required key in a schema level degrades its whole section the moment the game stops sending
 * it, so a required key must be one shipped code actually reads. The lists used to be transcribed
 * from whatever the game sent on a capture day; two item fields nobody important read were then
 * removed by a game update, every fresh items read was refused, and the app served stale data
 * until it was patched.
 *
 * Deliberately dumb text scanning over `git ls-files`, not a parse: a key counts as read when the
 * source contains a property access (`.key`), a bracket access (`['key']`), a quoted literal
 * (`'key'`, which is how destructuring defaults, `in` checks and wire-key tables spell it) or a
 * destructured name. That is a heuristic, and it errs toward finding a reader: a field called
 * `level` is found wherever any object has one. What it reliably catches is the case this guard
 * exists for, a key whose name appears nowhere in shipped code at all.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXPORT_FINGERPRINT, SCHEMA_LEVELS } from '../packages/domain/src/save-schema.ts';
import { ROUTE_FINGERPRINTS, SECTION_FINGERPRINTS } from '../packages/game-api/src/fingerprints.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const SHIPPED_SOURCE_ROOTS = /^(packages\/[^/]+\/src|apps\/desktop\/(src|renderer)|apps\/web\/src)\//;

/**
 * Test code, fixtures and the schema declarations themselves prove nothing about a reader. The
 * wire lexicons other than the rotation one are glossaries for other bodies, and the rotation
 * normalizer reads every rotation key through its lexicon, so that one counts.
 */
const NOT_A_READER =
  /\.test\.|\.stories\.|\/tests?\/|\/e2e\/|__fixtures__|\/fixtures\/|\.d\.ts$|test-fixtures\.|test-support\.|test-items\.|save-schema\.ts$|game-api\/src\/fingerprints\.ts$|wire-glossary\.|wire-lexicon\.|vocabulary-guard\.|game-api\/src\/(live-frame|pvp|collections)\/lexicon\.ts$/;

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

function shippedSources() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n');
  return tracked
    .filter((file) => /\.(ts|tsx|mjs|js)$/.test(file) && SHIPPED_SOURCE_ROOTS.test(file) && !NOT_A_READER.test(file))
    .map((file) => ({ file, text: stripComments(readFileSync(resolve(root, file), 'utf8')) }));
}

function readerPattern(key) {
  return new RegExp(`\\??\\.${key}\\b|\\[['"]${key}['"]\\]|['"]${key}['"]|[{,]\\s*${key}\\s*[,}:]`);
}

function readersOf(key, sources) {
  const pattern = readerPattern(key);
  return sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

function levelsOf(level, label, seen = new Map()) {
  if (seen.has(level)) return seen;
  seen.set(level, label);
  for (const [childKey, child] of Object.entries(level.children ?? {})) {
    if (child.kind === 'object') levelsOf(child.level, `${label}.${childKey}`, seen);
    if (child.kind === 'array') levelsOf(child.element, `${label}.${childKey}[]`, seen);
  }
  return seen;
}

function declaredLevels() {
  const seen = new Map();
  for (const [section, fingerprint] of Object.entries(ROUTE_FINGERPRINTS)) levelsOf(fingerprint.level, `route ${section}`, seen);
  for (const [section, fingerprint] of Object.entries(SECTION_FINGERPRINTS)) {
    levelsOf(fingerprint.kind === 'array' ? fingerprint.element : fingerprint.level, `section ${section}`, seen);
  }
  levelsOf(EXPORT_FINGERPRINT.level, 'export', seen);
  for (const [name, level] of Object.entries(SCHEMA_LEVELS)) levelsOf(level, `catalogue ${name}`, seen);
  return seen;
}

/** Every `label: key` for a required key that no shipped source reads. */
function unreadRequiredKeys(levels, sources) {
  const unread = [];
  for (const [level, label] of levels) {
    for (const key of level.keys) {
      if (readersOf(key, sources).length === 0) unread.push(`${label}: ${key}`);
    }
  }
  return unread;
}

describe('every required schema key has a reader in shipped code', () => {
  const sources = shippedSources();
  const levels = declaredLevels();

  it('scans a believable amount of shipped source, so a path change cannot make the guard vacuous', () => {
    expect(sources.length).toBeGreaterThan(500);
    expect(sources.some(({ file }) => file === 'packages/domain/src/import-save.ts')).toBe(true);
    expect(sources.some(({ file }) => file.endsWith('.test.ts'))).toBe(false);
    expect(sources.some(({ file }) => file.endsWith('save-schema.ts'))).toBe(false);
  });

  it('walks the route, section and export fingerprints and the shared catalogue', () => {
    const labels = [...levels.values()];
    expect(levels.size).toBeGreaterThanOrEqual(10);
    for (const expected of ['route account', 'route heroes.heroes[]', 'route items.items[]', 'route casa.heroes[]', 'export']) {
      expect(labels).toContain(expected);
    }
  });

  it('finds no required key without a reader', () => {
    expect(unreadRequiredKeys(levels, sources)).toEqual([]);
  });

  it('reports a required key that nothing reads, which is what keeps the lists from filling back up', () => {
    const bogus = new Map([[{ keys: ['id', 'zz_never_read_by_anything'] }, 'bogus level']]);
    expect(unreadRequiredKeys(bogus, sources)).toEqual(['bogus level: zz_never_read_by_anything']);
  });

  it('does not let a mention in a comment, a test or the schema file itself count as a reader', () => {
    expect(readersOf('ability_reroll_stone', sources)).toEqual([]);
    expect(readersOf('in_market', sources)).toEqual([]);
  });

  it('accepts each way a reader can spell a key', () => {
    const spelled = [
      { file: 'a.ts', text: 'const x = hero.rank_zz;' },
      { file: 'b.ts', text: "const y = hero['bracket_zz'];" },
      { file: 'c.ts', text: "if ('quoted_zz' in hero) return;" },
      { file: 'd.ts', text: 'const { destructured_zz, other } = hero;' },
    ];
    for (const key of ['rank_zz', 'bracket_zz', 'quoted_zz', 'destructured_zz']) {
      expect(readersOf(key, spelled)).toHaveLength(1);
    }
    expect(readersOf('absent_zz', spelled)).toEqual([]);
  });
});
