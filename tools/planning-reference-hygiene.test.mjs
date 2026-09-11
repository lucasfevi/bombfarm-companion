/**
 * The repo-wide half of the planning-reference rule: this repository is public, the planning
 * tree that drives it is not, so nothing tracked here may carry a reference only that tree can
 * resolve. Two shapes are forbidden — a planning identifier (`PREFIX-NUMBER`) and a path into a
 * planning document. Both had reached tracked source at scale before anything measured them,
 * because the rule lived only in `AGENTS.md` as a command nobody ran.
 *
 * Deliberately dumb text scanning over `git ls-files`, not a parse — the same convention
 * `tools/design-system-gate.test.mjs` and `tools/desktop-main-computes-nothing.test.mjs` use.
 * The rule covers comments, test names and prose equally, so a parse would only lose coverage.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

// Every tracked, public directory tree an agent authors prose into. `.github` (workflow YAML)
// and `.cursor` (editor rule files that mirror `docs/`) were absent for years, so no CI workflow
// or Cursor rule was ever scanned — a citation could sit in one indefinitely and this guard would
// still report green. The per-root assertion below fails if any root here scans zero files, so a
// root added without a matching extension cannot silently do nothing.
const SCANNED_ROOTS = ['apps', 'packages', 'tools', 'docs', '.changeset', '.github', '.cursor'];

/**
 * `CHANGELOG.md` is out of scope, and `.changeset/**` is in scope for exactly that reason:
 * `changeset version` relocates release-note prose verbatim out of `.changeset/<name>.md` into
 * each bumped package's changelog, so a pin over the changelog holds on `develop` and breaks on
 * the release branch — the same reason `tools/fixture-corpus-parity.test.mjs` excludes release
 * prose from its own scan. Guarding the changeset is guarding the only place the text is
 * authored; rewriting a published release note would falsify history without closing anything.
 */

/** Text files only; a match inside a minified bundle or an image is not a claim about source. */
const SCANNED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '.jsx',
  '.css',
  '.md',
  '.mdc',
  '.json',
  '.yml',
  '.yaml',
];

/**
 * Guard sources and their red-state fixtures have to name the tokens they forbid, or they stop
 * guarding while looking tidier. Every entry here is code ABOUT the rule, not a violation of it.
 * `AGENTS.md` names this exception; keep the list short and justify each addition.
 */
const GUARD_SOURCES = new Set([
  'tools/planning-reference-hygiene.test.mjs',
  'tools/pre-push-guard.test.mjs',
  'tools/wiki-drift-narrowed-rule.test.mjs',
  'apps/web/src/tests/farm-ranking-guards.test.ts',
  'packages/domain/tests/farm-optimize-guards.test.ts',
]);

/**
 * Genuine external standards share the `PREFIX-NUMBER` shape and must never be "cleaned".
 * The criterion the rule actually states is resolvability: a reference only the private
 * planning tree can resolve is a leak, and one this checkout defines itself is not. So the
 * numbering schemes this repo owns are exempt too, each named with the doc that defines it:
 * `ADR-` (`apps/web/docs/adr/`), `CMT-` (`docs/comments.md`), `MOD-` (`docs/naming.md`),
 * `DS-` (`docs/design-system.md`). Adding a prefix here means committing to publish its
 * definition; it is not a place to park an id whose home is elsewhere.
 */
const EXEMPT_PREFIXES = [
  'SHA-',
  'UTF-',
  'BCP-',
  'ISO-',
  'RFC-',
  'IEEE-',
  'ADR-',
  'CMT-',
  'MOD-',
  'DS-',
];

const PLANNING_IDENTIFIER = new RegExp(
  String.raw`\b(?!${EXEMPT_PREFIXES.join('|')})[A-Z][A-Z0-9]{1,6}-[0-9]{1,3}[a-z]?\b`,
);

/**
 * A regex character class spells `PREFIX-NUMBER` by accident: `[A-Z0-9]{8}` contains `Z0-9`,
 * `[a-fA-F0-9]{64}` contains `F0-9`. What separates a class from a markdown link label like
 * `[ADR-014](…)` is what follows the bracket — a quantifier means regex, a paren means link.
 * Stripping these before the identifier scan is the difference between a guard people run and
 * a wall of output people stop reading.
 */
function stripRegexCharacterClasses(text) {
  return text.replace(/\[\^?(?:\\.|[^\]\\])+\][*+?{]/g, ' ');
}

/**
 * `validation.md` is the one planning-document name this repo also owns (`docs/validation.md`),
 * so a bare mention is genuinely ambiguous. The rule the guard can state instead: outside the
 * doc trees, spell the in-repo one with its `docs/` prefix. Inside them, relative links are
 * normal and the name is exempt.
 */
function isDocTree(file) {
  return file.startsWith('docs/') || file.includes('/docs/');
}

const PLANNING_PATHS = [
  { name: 'specs-directory path', pattern: /\.specs\// },
  { name: 'design-document path', pattern: /\bdesign\.md\b/i },
  { name: 'tasks-document path', pattern: /\btasks\.md\b/i },
  { name: 'spec-document path', pattern: /\bspec\.md\b/i },
  { name: 'prd-document path', pattern: /\bprd\.md\b/i },
  { name: 'bare PRD reference', pattern: /\bPRD\b/ },
  // Dropping the `.md` does not make a pointer less resolvable — `design §4.6` names the same
  // private section `design.md §4.6` does. The word must be the whole word before the section
  // sign, so this repo's own `DESIGN_SYSTEM §4` (whose last word is `SYSTEM`) is not a match.
  { name: 'planning-document section pointer', pattern: /\b(?:design|spec|tasks|prd|validation) §/i },
];

const UNPREFIXED_VALIDATION_DOC = {
  name: 'unprefixed validation-document path',
  pattern: /(?<!docs\/)\bvalidation\.md\b/i,
};

/** Every offense on one line of one file, as rule names. */
export function planningReferenceOffenses(line, { file = '' } = {}) {
  const offenses = [];
  if (PLANNING_IDENTIFIER.test(stripRegexCharacterClasses(line))) {
    offenses.push('planning identifier');
  }
  for (const { name, pattern } of PLANNING_PATHS) {
    if (pattern.test(line)) offenses.push(name);
  }
  if (!isDocTree(file) && UNPREFIXED_VALIDATION_DOC.pattern.test(line)) {
    offenses.push(UNPREFIXED_VALIDATION_DOC.name);
  }
  return offenses;
}

function scannedFiles() {
  const tracked = execFileSync('git', ['ls-files', '-z', ...SCANNED_ROOTS], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);

  return tracked.filter(
    (file) =>
      SCANNED_EXTENSIONS.some((ext) => file.endsWith(ext)) &&
      !file.includes('/dist/') &&
      !file.endsWith('CHANGELOG.md') &&
      !GUARD_SOURCES.has(file),
  );
}

describe('planning-reference hygiene — no planning identifier or planning-document path in tracked files', () => {
  const files = scannedFiles();

  it('the scan covers a real, non-trivial file set (otherwise a green result proves nothing)', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('every scanned root actually contributes files (a renamed root must not silently drop out)', () => {
    for (const dir of SCANNED_ROOTS) {
      expect(
        files.filter((file) => file.startsWith(`${dir}/`)).length,
        `no scanned files under ${dir}/`,
      ).toBeGreaterThan(0);
    }
  });

  it('zero planning references across every tracked source, test, fixture and doc file', () => {
    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(join(root, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        const offenses = planningReferenceOffenses(line, { file });
        if (offenses.length > 0) {
          offenders.push(`${file}:${index + 1} — ${offenses.join(', ')}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('every named guard source still exists (a rename must not silently widen the exemption)', () => {
    for (const file of GUARD_SOURCES) {
      expect(() => readFileSync(join(root, file), 'utf8'), file).not.toThrow();
    }
  });
});

describe('planning-reference hygiene — the scan discriminates', () => {
  it('red state: a planning identifier is caught', () => {
    expect(planningReferenceOffenses('gate on usability (QQZ-07).')).toEqual(['planning identifier']);
  });

  it('red state: a section-qualified planning-document pointer is caught', () => {
    expect(planningReferenceOffenses('The tie-break order (design.md §4.6).')).toEqual([
      'design-document path',
    ]);
  });

  it('red state: a specs-directory path is caught', () => {
    const fabricated = ['.specs', '/features/example/tasks.md'].join('');
    expect(planningReferenceOffenses(fabricated)).toEqual([
      'specs-directory path',
      'tasks-document path',
    ]);
  });

  it('red state: outside the doc trees, an unprefixed validation-document path is caught', () => {
    expect(planningReferenceOffenses('recorded in validation.md', { file: 'packages/x/y.ts' })).toEqual(
      ['unprefixed validation-document path'],
    );
  });

  it('green state: external standards sharing the identifier shape are not offenses', () => {
    expect(planningReferenceOffenses('IEEE-754 order differs; see RFC-6455 and ISO-8601.')).toEqual([]);
  });

  it("green state: this repo's own public decision records are not offenses", () => {
    expect(planningReferenceOffenses('- [ADR-014](014-parallel-slot-visibility.md)')).toEqual([]);
  });

  it('green state: a regex character class is not an identifier', () => {
    expect(planningReferenceOffenses(String.raw`expect(src).not.toMatch(/F-[A-Z0-9]{8}/);`)).toEqual([]);
    expect(planningReferenceOffenses(String.raw`const hex = /[a-fA-F0-9]{64}/;`)).toEqual([]);
  });

  it('green state: the in-repo validation doc, spelled with its docs/ prefix, is not an offense', () => {
    expect(planningReferenceOffenses('see docs/validation.md', { file: 'packages/x/y.ts' })).toEqual([]);
  });

  it('green state: the design-system doc is not a planning-document path', () => {
    expect(planningReferenceOffenses('see docs/design-system.md')).toEqual([]);
  });
});
