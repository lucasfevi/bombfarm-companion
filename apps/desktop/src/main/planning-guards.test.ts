/**
 * Source guards for MP3 F2 (design.md §6, §11, MPV-14/16/18/21/22). Home: `apps/desktop/src/main`
 * (not `tools/`) — every assertion here needs the desktop's own `apps/desktop` tree walked with
 * TypeScript-aware file listing, matching the `contracts-import-is-type-only.test.ts` genre
 * (`packages/domain/tests/`) rather than the `.mjs`-only `tools/` convention; `tools/` is reserved
 * here for the DS-09 extension to `design-system-gate.test.mjs` (T6's second file) and for T7's
 * spec-list guard, which both need to read outside `apps/desktop`.
 *
 * Every scan strips comments first — several of these guards are described in this repo's own
 * doc comments (e.g. `hero-advice.ts` explains *why* `computeAdvisorPipeline` is never called
 * here), and a bare substring match would flag that prose as a violation of the very rule it is
 * documenting. Stripping comments means each guard asserts real code, not text.
 */
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const RENDERER_ROOT = join(DESKTOP_ROOT, 'renderer');
const PLANNING_APP_ROOT = join(RENDERER_ROOT, 'app', 'planning');
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

const ALL_DESKTOP_SOURCE = () => readAll(DESKTOP_ROOT, ['.ts', '.tsx']);
const ALL_DESKTOP_SOURCE_INCLUDING_TESTS = () => readAll(DESKTOP_ROOT, ['.ts', '.tsx'], { includeTests: true });

describe('D22 survives D24 — no upload affordance anywhere under apps/desktop (design hazard 5)', () => {
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
        `Found "${name}" under apps/desktop in: ${offenders.join(', ')}. D22 (the export-drop ` +
          `survives D24) forbids any file dialog, drop zone or SaveFile_BombFarm watch anywhere ` +
          `in the desktop app — MP2 owns ingest, F2 adds none.`,
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

describe('One mapping (design hazard 2, MPV-21) — pipelineForHero is the only HeroRecord-to-advice entry', () => {
  it('computeAdvisorPipeline is never imported or called from apps/desktop source (test files excluded — they legitimately compute the fallback-to-prove-absent value)', () => {
    const offenders = ALL_DESKTOP_SOURCE()
      .filter((file) => /computeAdvisorPipeline\s*\(|\bimport\s*\{[^}]*\bcomputeAdvisorPipeline\b/.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(
      offenders,
      `Found computeAdvisorPipeline referenced outside a test in: ${offenders.join(', ')}. ` +
        `The desktop must map a HeroRecord to advice through the exported pipelineForHero only — ` +
        `assembling computeAdvisorPipeline's input directly is exactly the second mapping AD-032 exists to prevent.`,
    ).toEqual([]);
  });

  it('pipelineForHero is imported exactly once outside tests, in renderer/lib/planning/hero-advice.ts', () => {
    const importers = ALL_DESKTOP_SOURCE()
      .filter((file) => /\bimport\s*\{[^}]*\bpipelineForHero\b[^}]*\}\s*from/.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(importers).toHaveLength(1);
    expect(importers[0]).toMatch(/renderer[\\/]lib[\\/]planning[\\/]hero-advice\.ts$/);
  });

  it('red state demonstrated: a fixture importing computeAdvisorPipeline is caught', () => {
    const fixtureSource = "import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';";
    expect(/computeAdvisorPipeline\s*\(|\bimport\s*\{[^}]*\bcomputeAdvisorPipeline\b/.test(fixtureSource)).toBe(true);
  });
});

describe('No default-filling (design §4.3) — DEFAULT_TREE/DEFAULT_CONTEXT never exist under apps/desktop', () => {
  it('zero occurrences of the identifiers DEFAULT_TREE or DEFAULT_CONTEXT as real code (comments stripped, test files excluded — test descriptions legitimately name the absent identifiers to describe what they assert)', () => {
    const offenders = ALL_DESKTOP_SOURCE()
      .filter((file) => /\bDEFAULT_TREE\b|\bDEFAULT_CONTEXT\b/.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(
      offenders,
      `Found DEFAULT_TREE/DEFAULT_CONTEXT under apps/desktop in: ${offenders.join(', ')}. ` +
        `A null tree/context must withhold, never fall back to an invented identity value — ` +
        `that is exactly the zero-tree-fallback hazard D24 exists to forbid.`,
    ).toEqual([]);
  });

  it('red state demonstrated: a fixture declaring DEFAULT_TREE as real code is caught', () => {
    const fixtureSource = 'function DEFAULT_TREE() { return {}; }';
    expect(/\bDEFAULT_TREE\b/.test(stripComments(fixtureSource))).toBe(true);
  });
});

describe('No local controls under renderer/app/planning/** (MPV-14)', () => {
  const planningComponentFiles = readAll(PLANNING_APP_ROOT, ['.tsx']);

  it('no <button, <select, <table or <input element literal', () => {
    // Case-sensitive: JSX intrinsic (lowercase-tag) elements are the hazard; component
    // references like `<Button>`/`<DataTable.Table>` start with an uppercase letter and must
    // not be flagged.
    const offenders: string[] = [];
    for (const file of planningComponentFiles) {
      const stripped = stripComments(file.source);
      if (/<(button|select|table|input)\b/.test(stripped)) offenders.push(file.path);
    }
    expect(
      offenders,
      `Found a bespoke <button>/<select>/<table>/<input> element under renderer/app/planning/** ` +
        `in: ${offenders.join(', ')}. Every control there must be a @bombfarm/ui primitive (MPV-14).`,
    ).toEqual([]);
  });

  it('red state demonstrated: a fixture with a bare <button> element is caught', () => {
    expect(/<(button|select|table|input)\b/.test('<button type="button">Click</button>')).toBe(true);
  });
});

describe('Copy guard (MPV-16, design §6) — no player-facing literal outside lib/copy/', () => {
  // Fixed here and justified: these are never player-facing text (a DOM hook, a Tailwind class
  // list, a link target, an id, an ARIA role/type token, a React list key). Widening this list
  // later needs a comment naming which AC it weakens.
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

  /** JSX text nodes: text directly between `>` and `<`, excluding pure whitespace/punctuation. */
  function findTextNodeViolations(source: string): string[] {
    const stripped = stripComments(source);
    const violations: string[] = [];
    for (const match of stripped.matchAll(/>([^<>{}\n]+)</g)) {
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
    const badTitleFixture = '<EmptyState title="No heroes to plan for yet" />';
    expect(findLiteralPropViolations(badTitleFixture)).toEqual(['title="No heroes to plan for yet"']);

    const badTextNodeFixture = '<h2 className="text-base">Next-point ranking</h2>';
    expect(findTextNodeViolations(badTextNodeFixture)).toEqual(['Next-point ranking']);
  });

  it("allowlisted props (data-testid, className, href, id, role, type, key) are not flagged even though they are string literals", () => {
    const fixture = '<DataTable.Row key="h1" data-testid="roster-row-h1" className="flex" role="row" type="button" id="x" href="#" />';
    expect(findLiteralPropViolations(fixture)).toEqual([]);
    for (const prop of ALLOWED_PROPS) {
      expect(fixture).toContain(`${prop}=`);
    }
  });
});
