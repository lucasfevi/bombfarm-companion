/**
 * The repo-wide half of the planning-reference rule: this repository is public, the planning
 * tree that drives it is not, so nothing tracked here may carry a reference only that tree can
 * resolve. Two shapes are forbidden — a planning identifier (`PREFIX-NUMBER`, or its unhyphenated
 * milestone-and-feature and work-item-slug forms) and a path into a planning document. Both had
 * reached tracked source at scale before anything measured them, because the rule lived only in
 * `AGENTS.md` as a command nobody ran.
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
 * The same citation without the hyphen: a milestone token glued to its number, a space, then a
 * feature number (`QQ7 F2`). It dodged the identifier scan for as long as that scan existed. The
 * milestone half must be letters immediately followed by digits, so a function key on its own
 * (`F1`), an audio format (`MP3`), a version (`Windows 11 F1`) or a standard ending in a letter
 * (`W3C`) never completes the shape.
 */
const MILESTONE_FEATURE_CITATION = /\b[A-Z]{1,4}[0-9]{1,2} F[0-9]{1,2}\b/;

/**
 * A milestone's work-item slug cited as provenance (`mp7-example-work-item`, `m7-example-item`,
 * or the capitalised one-word `M7-widgets`). The lowercase form needs at least
 * two words after the number, which keeps a media file name like `mp3-sample.ogg` or `mp4-clip`
 * out; the capitalised one-word form skips a participle, so `M1-based` and `MP3-encoded` pass.
 */
const MILESTONE_SLUG =
  /\b(?:[mM][pP]?[0-9]{1,2}(?:-[a-z][a-z0-9]*){2,}|MP?[0-9]{1,2}-(?![a-z]+ed\b)[a-z]{3,}\b)/;

/**
 * A milestone number cited on its own (`MP7`). Nothing else in this repo spells `MP` and a number
 * except an audio or video format, and a format is followed by the thing it encodes.
 */
const MILESTONE_NUMBER =
  /\bMP[0-9]{1,2}\b(?!-|\s+(?:files?|clips?|audio|video|tracks?|streams?|formats?|players?)\b)/;

/** A wave or milestone spelled out with its number (`Wave 9`, `pre-Wave-9`, `milestone 9`). */
const SPELLED_PLAN_NUMBER = /\b(?:[Ww]ave|[Mm]ilestone)[ -][0-9]{1,2}\b/;

/**
 * A wave, task or milestone number (`W9`, `T19`, `M9`) — the bare token, which is also an SVG
 * move-to (`M13.5 8`), a PVP streak (`W2`), a tier (`T3`) or a time variable (`T1 - T0`) in
 * code. So it is only an offense in prose: a markdown line, a comment, or a test title, where
 * none of those appear. The `M` form still skips a trailing coordinate, and `T` a clock time,
 * for the SVG or timestamp a comment quotes; `W` never starts either, and a leading zero (`T01`,
 * a skill-tree node id) is never a plan number.
 */
const PLAN_STEP_NUMBER =
  /\b(?:W[1-9][0-9]?\b|T[1-9][0-9]?[a-z]?\b(?!:[0-9])|M[0-9]{1,2}\b(?![ ,]?-?[0-9.]|-[a-z]))/;

const TEST_TITLE = /\b(?:describe|it|test)(?:\.[a-z]+)*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
const LINE_COMMENT = /^\s*(?:\/\/|\/\*|\*|\{\/\*)/;
const TRAILING_COMMENT = /(?<![:\\'"`])\/\/(.*)$|\/\*(.*?)(?:\*\/|$)/g;

/**
 * The parts of one line that are prose rather than code: the whole line in markdown, the comment
 * in YAML and source, and every test title. JSON carries no prose this rule can separate from data.
 */
function proseOf(line, file) {
  if (/\.mdc?$/.test(file)) return [line];
  if (/\.ya?ml$/.test(file)) return [/(?:^|\s)#(.*)$/.exec(line)?.[1] ?? ''];
  if (file.endsWith('.json')) return [];
  if (LINE_COMMENT.test(line)) return [line];
  const prose = [];
  for (const match of line.matchAll(TRAILING_COMMENT)) prose.push(match[1] ?? match[2] ?? '');
  for (const match of line.matchAll(TEST_TITLE)) prose.push(match[2]);
  return prose;
}

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
  // sign; the design-system planning document has its own entry below.
  { name: 'planning-document section pointer', pattern: /\b(?:design|spec|tasks|prd|validation) §/i },
  // The design-system planning document is not in this checkout — `docs/design-system.md` is the
  // public one — so its name, with or without `.md` or a section, only resolves privately.
  { name: 'design-system planning document', pattern: /\bDESIGN_SYSTEM\b/ },
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
  if (MILESTONE_FEATURE_CITATION.test(line)) offenses.push('milestone-feature citation');
  if (MILESTONE_SLUG.test(line)) offenses.push('milestone work-item slug');
  if (MILESTONE_NUMBER.test(line)) offenses.push('milestone number');
  if (SPELLED_PLAN_NUMBER.test(line)) offenses.push('spelled-out wave or milestone number');
  if (proseOf(line, file).some((prose) => PLAN_STEP_NUMBER.test(prose))) {
    offenses.push('wave, task or milestone number in prose');
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

  it('red state: a space-separated milestone-and-feature citation is caught', () => {
    expect(planningReferenceOffenses('// QQ7 F2: re-pointed onto the capture')).toEqual([
      'milestone-feature citation',
    ]);
    expect(planningReferenceOffenses('a second bilingual layer (QQZ12 F4) — it')).toEqual([
      'milestone-feature citation',
    ]);
  });

  it('red state: a milestone work-item slug cited as provenance is caught', () => {
    expect(planningReferenceOffenses('# The corpus (`mp7-example-rebaseline`)')).toEqual([
      'milestone work-item slug',
    ]);
    expect(planningReferenceOffenses(' * guards this rests on (mp7-live-example-read).')).toEqual([
      'milestone work-item slug',
    ]);
  });

  it('red state: a lowercase or capitalised single-letter milestone slug is caught', () => {
    expect(planningReferenceOffenses('  // toast `success` variant (m9-example-item)')).toEqual([
      'milestone work-item slug',
    ]);
    expect(planningReferenceOffenses('// M9-widgets: Icon, iconSources added')).toEqual([
      'milestone work-item slug',
    ]);
  });

  it('red state: a bare milestone number is caught anywhere', () => {
    expect(planningReferenceOffenses('    // not the constant this has returned since MP9.')).toEqual([
      'milestone number',
    ]);
    expect(planningReferenceOffenses('"accountLabel": "MP9 reference account"', { file: 'x.json' })).toEqual([
      'milestone number',
    ]);
  });

  it('red state: a wave or milestone spelled out with its number is caught', () => {
    expect(planningReferenceOffenses('## Wave 9 — naked is tree-free', { file: 'docs/x.md' })).toEqual([
      'spelled-out wave or milestone number',
    ]);
    expect(planningReferenceOffenses("it('defaults to 0 (pre-Wave-9 record)', () => {")).toEqual([
      'spelled-out wave or milestone number',
    ]);
  });

  it('red state: a wave, task or milestone number in a comment, test title, doc or YAML comment is caught', () => {
    for (const [line, file] of [
      ['      // W9: no component defined inside another component render.', 'x.mjs'],
      [' * guard (T19). The last five are produced elsewhere', 'x.ts'],
      ['  /** Flavor badge — kept from M9; the smoke test asserts it. */', 'x.tsx'],
      ['const TOL = 1e-9; // stated once, per T17.', 'x.ts'],
      ['/* Promoted from import dialog (W9). */', 'x.css'],
      ["describe('planner store scaffold (W9 T29)', () => {", 'x.test.ts'],
      ["  it('M9 discrimination: keeps no stale field', () => {", 'x.test.ts'],
      ['was deleted in T9a rather than migrated.', 'docs/x.md'],
      ['| session | W9 | lang, toast |', 'docs/x.md'],
      ['      # W9 guardrail — warn first', '.github/workflows/x.yml'],
    ]) {
      expect(planningReferenceOffenses(line, { file }), line).toEqual([
        'wave, task or milestone number in prose',
      ]);
    }
  });

  it('red state: the design-system planning document is caught by name', () => {
    expect(planningReferenceOffenses(' * every policy decision DESIGN_SYSTEM.md §11 specifies')).toEqual([
      'design-system planning document',
    ]);
  });

  it('green state: code that spells a wave, task or milestone token is not an offense', () => {
    for (const [line, file] of [
      ["    expect(html).toContain('last 12, win rate 17%, streak W2');", 'x.test.tsx'],
      ["    expect(html).toContain('120 (T3, floor 100)');", 'x.test.tsx'],
      ['            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />', 'x.tsx'],
      ["  'M11.98 0C5.67 0 .5 4.87 0 11.05l6.44 2.66',", 'x.tsx'],
      ['const elapsed = T1 - T0;', 'x.ts'],
      ['function lerp<T1, T2>(from: T1, to: T2) {}', 'x.ts'],
      ['    new Date(`${isoDay}T00:00:00Z`),', 'x.ts'],
      ['  T01: \'sangue_ouro\',', 'x.ts'],
      ['      "id": "T01",', 'x.json'],
      ["<div className='w-2 mt-4 grid-cols-2 md:w-1/2' />", 'x.tsx'],
    ]) {
      expect(planningReferenceOffenses(line, { file }), line).toEqual([]);
    }
  });

  it('green state: prose that shares part of the wave, task or milestone shapes is not an offense', () => {
    for (const [line, file] of [
      ['// the icon path is M0 0 L10 10, drawn as M3.5 7h7', 'x.ts'],
      ['// the cycle resets at T12:00, stamped 2026-08-13T12:00:00Z', 'x.ts'],
      ['// an MP3-encoded clip beside an MP4 file', 'x.ts'],
      ['// Apple M1-based Macs run the arm64 build', 'x.ts'],
      ['// the knight moves e4 to f6; press F1 for help', 'x.ts'],
      ['/* w-12 h-12, colour #1a2b3c, hash 3f2a9b1c */', 'x.css'],
      ['A tier-2 hero after 2 waves, per the W3C spec', 'docs/x.md'],
      ['the planner waves and the milestones are named in words, not numbers', 'docs/x.md'],
      ['`DESIGN_SYSTEM_TOKENS` is a constant, not the document', 'docs/x.md'],
    ]) {
      expect(planningReferenceOffenses(line, { file }), line).toEqual([]);
    }
  });

  it('green state: text that shares part of the milestone shapes is not an offense', () => {
    for (const line of [
      'press F1 for help, or F12 for the console',
      'an MP3 file and an MP4 clip',
      'SHA-256 of the 2026-08-13 export, per the W3C spec',
      'Windows 11 F1 key',
      'phase 5 F1 row',
      'assets/mp3-sample.ogg and mp4-clip.webm',
      'hero6-menu-idle/hero6_idle_menu1.png',
      'the (L38) hero at phase 24',
    ]) {
      expect(planningReferenceOffenses(line), line).toEqual([]);
    }
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
