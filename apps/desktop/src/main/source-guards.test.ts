/**
 * Source guards over the desktop tree. Home: `apps/desktop/src/main` (not `tools/`) — every
 * assertion here needs the desktop's own `apps/desktop` tree walked with TypeScript-aware file
 * listing, matching the `contracts-import-is-type-only.test.ts` genre (`packages/domain/tests/`)
 * rather than the `.mjs`-only `tools/` convention; `tools/` is reserved here for guards that need
 * to read outside `apps/desktop`.
 *
 * Every scan strips comments first — several of these guards are described in this repo's own
 * doc comments, and a bare substring match would flag that prose as a violation of the very rule
 * it is documenting. Stripping comments means each guard asserts real code, not text.
 */
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const RENDERER_ROOT = join(DESKTOP_ROOT, 'renderer');
/** This guard file's own path — excluded from every scan below. Its "red state demonstrated"
 *  tests deliberately contain the forbidden substrings as plain JS string literals (fixtures),
 *  which would otherwise flag the guard against itself. `__filename`, not `import.meta.url`:
 *  this file is also picked up by `tsconfig.main.json`'s CommonJS build. */
const SELF_PATH = __filename;

const { readAll } = guardScanner(SELF_PATH);

/** Strips `//` line comments and `/* *\/` block comments (dumb text slicing, not a full parser —
 *  the repo's own established convention here, per `contracts-import-is-type-only.test.ts`). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ALL_DESKTOP_SOURCE_INCLUDING_TESTS = () => readAll(DESKTOP_ROOT, ['.ts', '.tsx'], { includeTests: true });

describe('no upload affordance anywhere under apps/desktop', () => {
  const patterns: [string, RegExp][] = [
    ['showOpenDialog', /showOpenDialog/],
    ['<input type="file"', /<input[^>]*type=["']file["']/],
    ['FileDropZone', /FileDropZone/],
    ['SaveFile_BombFarm', /SaveFile_BombFarm/],
    ['ondrop/onDrop', /\bon[Dd]rop\b/],
  ];

  for (const [name, pattern] of patterns) {
    it(`zero occurrences of ${name}`, () => {
      const offenders = ALL_DESKTOP_SOURCE_INCLUDING_TESTS()
        .map((file) => ({ file, matched: pattern.test(stripComments(file.source)) }))
        .filter((entry) => entry.matched)
        .map((entry) => entry.file.path);
      expect(
        offenders,
        `Found "${name}" under apps/desktop in: ${offenders.join(', ')}. The desktop app never ` +
          `asks a player for a save file — no file dialog, no drop zone, no watch on the game's ` +
          `own export. The account is read from the running game, and only from there.`,
      ).toEqual([]);
    });
  }

  it('red state demonstrated: a temporary showOpenDialog reference is caught', () => {
    const offenders = [{ path: 'fixture.ts', source: 'void showOpenDialog();' }]
      .filter((file) => /showOpenDialog/.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(offenders).toEqual(['fixture.ts']);
  });
});

describe('Copy guard — no player-facing literal outside lib/copy/', () => {
  // Fixed here and justified: these are never player-facing text (a DOM hook, a Tailwind class
  // list, a link target, an id, an ARIA role/type token, a React list key). Widening this list
  // later needs a comment saying which rule it weakens.
  const ALLOWED_PROPS = new Set(['data-testid', 'className', 'href', 'id', 'role', 'type', 'key']);
  const CHECKED_PROPS = ['title', 'label', 'description', 'aria-label', 'placeholder'] as const;

  const rendererFiles = readAll(RENDERER_ROOT, ['.tsx']).filter(
    (file) => !file.path.includes(`lib${sep}copy${sep}`),
  );

  function findLiteralPropViolations(source: string): string[] {
    const stripped = stripComments(source);
    const violations: string[] = [];
    for (const prop of CHECKED_PROPS) {
      const pattern = new RegExp(`\\b${prop}=(["'])((?:(?!\\1).)*)\\1`, 'g');
      for (const match of stripped.matchAll(pattern)) {
        const value = match[2] ?? '';
        violations.push(`${prop}="${value}"`);
      }
    }
    return violations;
  }

  /**
   * JSX text nodes: text directly between `>` and `<`, excluding pure whitespace/punctuation.
   *
   * The `>` must not be the tail of an arrow. A prop typed `(x: T) => Promise<U>` otherwise reads
   * as the text node `Promise`, which is a type annotation and not player-facing copy — the first
   * `.tsx` here to take an async callback prop tripped this.
   */
  function findTextNodeViolations(source: string): string[] {
    const stripped = stripComments(source);
    const violations: string[] = [];
    for (const match of stripped.matchAll(/(?<!=)>([^<>{}\n]+)</g)) {
      const captured = match[1];
      if (captured === undefined) continue;
      const text = captured.trim();
      if (text.length === 0) continue;
      if (!/[A-Za-z]/.test(text)) continue; // numbers/punctuation-only — not player-facing prose
      violations.push(text);
    }
    return violations;
  }

  it('no title=/label=/description=/aria-label=/placeholder= prop is a string literal', () => {
    const offenders: { path: string; violations: string[] }[] = [];
    for (const file of rendererFiles) {
      const violations = findLiteralPropViolations(file.source);
      if (violations.length > 0) offenders.push({ path: file.path, violations });
    }
    expect(
      offenders,
      `Found literal title/label/description/aria-label/placeholder props outside lib/copy/: ` +
        offenders.map((o) => `${o.path} (${o.violations.join(', ')})`).join('; '),
    ).toEqual([]);
  });

  it('no non-empty JSX text node is a string literal outside the allowlist', () => {
    const offenders: { path: string; violations: string[] }[] = [];
    for (const file of rendererFiles) {
      const violations = findTextNodeViolations(file.source);
      if (violations.length > 0) offenders.push({ path: file.path, violations });
    }
    expect(
      offenders,
      `Found literal JSX text nodes outside lib/copy/: ` +
        offenders.map((o) => `${o.path} (${o.violations.join(', ')})`).join('; '),
    ).toEqual([]);
  });

  it('red state demonstrated (observed and recorded here, never left in a component): inlining one string is caught by both checks', () => {
    const badTitleFixture = '<EmptyState title="No items to show yet" />';
    expect(findLiteralPropViolations(badTitleFixture)).toEqual(['title="No items to show yet"']);

    const badTextNodeFixture = '<h2 className="text-base">Everything you own</h2>';
    expect(findTextNodeViolations(badTextNodeFixture)).toEqual(['Everything you own']);
  });

  it('reads an arrow return type as a type and not as copy, while still catching text after it', () => {
    // Both halves matter: dropping the arrow case must not also drop a real violation sitting
    // next to one, which is the way this exemption would quietly stop guarding.
    expect(findTextNodeViolations('onRefresh: (t: Target) => Promise<Result>;')).toEqual([]);
    expect(
      findTextNodeViolations('type F = () => Promise<void>;\nconst x = <p className="a">Sell it</p>;'),
    ).toEqual(['Sell it']);
  });

  /**
   * The farm screen brings a SECOND supplier of player-facing strings into this renderer — the
   * dictionary `@bombfarm/farm` ships with the views it draws. The copy guard above cannot see it
   * (those strings are not literals in this tree), so the one-place-for-copy invariant is kept
   * structurally instead: exactly one module may reach that dictionary, and it composes the two
   * halves for everything else.
   */
  const FARM_COPY_MODULE = join(RENDERER_ROOT, 'app', 'farm', 'farm-copy.ts');
  const FARM_COPY_IMPORT = /from\s*['"]@bombfarm\/farm\/copy['"]/;

  function farmCopyImporters(files: readonly { path: string; source: string }[]): string[] {
    return files.filter((file) => FARM_COPY_IMPORT.test(stripComments(file.source))).map((file) => file.path);
  }

  it('only app/farm/farm-copy.ts imports the farm dictionary', () => {
    const importers = farmCopyImporters(readAll(RENDERER_ROOT, ['.ts', '.tsx']));
    expect(
      importers,
      `Only ${FARM_COPY_MODULE} may import the farm screen's dictionary — every other module ` +
        `reads copy through lib/copy. Found: ${importers.join(', ')}`,
    ).toEqual([FARM_COPY_MODULE]);
  });

  it('red state demonstrated: a second module reaching for the farm dictionary is caught', () => {
    const fixture = [
      { path: 'second.tsx', source: "import { farmCopyFor } from '@bombfarm/farm/copy';" },
    ];
    expect(farmCopyImporters(fixture)).toEqual(['second.tsx']);
  });

  it("allowlisted props (data-testid, className, href, id, role, type, key) are not flagged even though they are string literals", () => {
    const fixture = '<DataTable.Row key="i1" data-testid="inventory-row-i1" className="flex" role="row" type="button" id="x" href="#" />';
    expect(findLiteralPropViolations(fixture)).toEqual([]);
    for (const prop of ALLOWED_PROPS) {
      expect(fixture).toContain(`${prop}=`);
    }
  });
});
