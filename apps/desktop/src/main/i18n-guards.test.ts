/**
 * The assertions this repo writes down rather than reviews for: the pinned prose-literal
 * exception list, and the single game-terms language mapping.
 * Lives in `apps/desktop/src/main/`, NOT `tools/`, for two reasons: the scans need the desktop
 * tree walked (`source-guards.test.ts`'s own precedent, same home, same genre), and keeping
 * `tools/` untouched keeps `ci-fidelity.yml`'s `--project tools` step out of this file's blast
 * radius entirely.
 *
 * `walk`/`readAll`/`isTestFile` come from `guard-scan.ts`, shared with the other guards in this
 * folder. `stripComments` stays local — this file's copy carries a deliberate divergence, noted
 * on the function itself.
 */
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner, isTestFile, walk } from './guard-scan';
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, type ConsentText } from '@bombfarm/game-api';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const RENDERER_ROOT = join(DESKTOP_ROOT, 'renderer');
const MAIN_ROOT = join(DESKTOP_ROOT, 'src', 'main');
const REPO_ROOT = resolve(DESKTOP_ROOT, '..', '..');
/** This guard file's own path — excluded from every scan below, same reasoning as
 *  `source-guards.test.ts`'s `SELF_PATH`: its own red-state fixtures contain the forbidden
 *  shapes as plain JS string literals. */
const SELF_PATH = __filename;

const { readAll } = guardScanner(SELF_PATH);

/**
 * Strips `//` line comments and `/* *\/` block comments (dumb text slicing, not a full parser —
 * `source-guards.test.ts`'s own established convention). **One deliberate divergence from that
 * file's copy**: the line-comment regex here has a `(?<!:)` guard on `//`, because this guard
 * (unlike `source-guards.test.ts`'s narrow substring checks) scans EVERY string/template
 * literal, and without the guard `'http://127.0.0.1:3000'` gets misread as a line comment
 * starting at its own `//`, silently deleting the string's closing quote and corrupting every
 * match downstream — discovered empirically while building Guard 1 below, against
 * `apps/desktop/src/main/env.ts`'s `RENDERER_DEV_URL`. `source-guards.test.ts` never triggers
 * this because it never runs a literal-content scan broad enough to reach a URL string.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------------------------
// Guard 1 — prose-shaped literals across .ts AND .tsx, in BOTH processes
// ---------------------------------------------------------------------------------------------

/** Two adjacent alphabetic words separated by a space — the one property that separates prose
 *  ('just now', 'Game not running') from tokens (enum values, testids, channel names, BCP-47
 *  tags), which are all single words. See this describe block's own doc comment for what this
 *  rule cannot catch. */
const PROSE_SHAPE = /[A-Za-z]{2,}[ ][A-Za-z]{2,}/;
/** Single-quoted, double-quoted, or template literal contents (dumb text slicing: does not
 *  understand escaped quotes inside quotes of a DIFFERENT kind, which this codebase's style does
 *  not produce). */
const STRING_OR_TEMPLATE_LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

/**
 * What Guard 1 does NOT treat as player-facing, and why — measured empirically against this
 * repo's actual content while building this guard (the obvious regex, applied literally,
 * false-positives on all four categories below; this narrows where it looks, not what it
 * catches):
 *
 * 1. **`className=` values.** Tailwind utility strings are MULTIPLE space-joined single-word
 *    tokens in ONE literal ('flex justify-end gap-2'); the boundary between two tokens can look
 *    like two prose words ('font-mono tabular-nums' contains 'mono tabular'). The copy guard in
 *    `source-guards.test.ts` never scans `className` for exactly this reason (its
 *    `ALLOWED_PROPS` set).
 * 2. **`'use client'` / `'use server'`** — React/Next.js directives, not prose, exact-matched.
 * 3. **SQL text** (`db.prepare(...)`  bodies: `SELECT`/`INSERT INTO`/`CREATE TABLE`/`PRAGMA`/
 *    `ON CONFLICT`) — recognisable by keyword, and never player-facing.
 * 5. **The immediate first argument to `new Error(...)`, `console.*(...)`, `log.*(...)`, or
 *    `execSync(...)`** — diagnostic/log text, never rendered: every hit is a log field, an
 *    internal Error message, or a comment. A main-process message that DID reach the UI would be
 *    fixed structurally, never exempted here — this exclusion is about text that was NEVER
 *    rendered.
 */
const CLASS_NAME_CONTEXT = /className=$/;
const SQL_KEYWORDS = /\b(SELECT|INSERT INTO|CREATE TABLE|PRAGMA|ON CONFLICT|DELETE FROM)\b/;
const NON_PROSE_CALL_CONTEXT = /(new\s+Error\(\s*$|console\.\w+\(\s*$|log\.\w+\(\s*$|execSync\(\s*$|\.write\(\s*$)/;
const CONTEXT_WINDOW = 40;

/** A template literal's `${expr}` segments are JS CODE, not literal text — `new Date()` inside
 *  one (`storage/index.ts`'s corrupt-file rename suffix) contains a real space between two real
 *  English words purely as an artifact of the expression's own source text. Stripped before the
 *  prose test so only the literal text AROUND the interpolations is ever judged — exactly what a
 *  player would actually see, since the player never sees the expression's source either. */
function withoutInterpolations(value: string): string {
  return value.replace(/\$\{[^}]*\}/g, '');
}

function isExcludedLiteral(stripped: string, matchIndex: number, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === 'use client' || trimmed === 'use server') return true;
  if (SQL_KEYWORDS.test(value)) return true;
  const before = stripped.slice(Math.max(0, matchIndex - CONTEXT_WINDOW), matchIndex);
  if (CLASS_NAME_CONTEXT.test(before)) return true;
  if (NON_PROSE_CALL_CONTEXT.test(before)) return true;
  return false;
}

function findProseLiterals(source: string): string[] {
  const stripped = stripComments(source);
  const violations: string[] = [];
  for (const match of stripped.matchAll(STRING_OR_TEMPLATE_LITERAL)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    if (!PROSE_SHAPE.test(withoutInterpolations(value))) continue;
    if (isExcludedLiteral(stripped, match.index, value)) continue;
    violations.push(value);
  }
  return violations;
}

const GUARD_1_EXCLUDE = (path: string): boolean =>
  path.includes(`lib${sep}copy${sep}`) ||
  isTestFile(path) ||
  path.includes(`fixtures${sep}`) ||
  path === SELF_PATH ||
  // layout.tsx is explicitly UNCHANGED by design — a prebuilt static export cannot know
  // the locale; page.tsx sets documentElement.lang at runtime instead. Its <head> `metadata`
  // (browser-tab title / SEO description) is Next.js page metadata, not shell UI copy, and is
  // out of the every-string-renders-in-PT-BR requirement's "the desktop shell" scope the same way it is out of F4's edit list.
  path.endsWith(join('app', 'layout.tsx')) ||
  // A PowerShell cmdlet string built for execSync() (game-reader/process.ts) — assigned to a
  // local variable first, so it is one indirection away from the NON_PROSE_CALL_CONTEXT check
  // above and is excluded by file instead. Never rendered; findProcessId() returns a PID or null.
  path.endsWith(join('game-reader', 'process.ts')) ||
  // Same shape, same reason (live-source/live-source.ts): its own PowerShell cmdlet strings are
  // assigned to a local variable before reaching execSync(). Never rendered; the calls return a
  // process list or a file's bytes.
  path.endsWith(join('live-source', 'live-source.ts')) ||
  // live-source/image-scan.ts's READ_HOOK_ANCHORS: literal text this module looks for inside the
  // game's own on-disk binary, not text this app ever displays — the same "technical, never
  // rendered" shape the two exclusions above cover, just reached as a plain array instead of an
  // execSync() argument.
  path.endsWith(join('live-source', 'image-scan.ts'));

describe('Guard 1 — no player-facing literal outside the i18n source', () => {
  // What this rule CANNOT catch, stated rather than glossed (design §9, hazard 2): a one-word
  // player-facing literal ('Loading'), and the one-letter s/m abbreviations §2.3 names. Those are
  // covered BEHAVIOURALLY instead, by format.test.ts's both-locales assertions — a
  // guard that claims more than it proves is worse than one that states its edge.
  const rendererFiles = readAll(RENDERER_ROOT, ['.ts', '.tsx']).filter((file) => !GUARD_1_EXCLUDE(file.path));
  const mainFiles = readAll(MAIN_ROOT, ['.ts']).filter((file) => !GUARD_1_EXCLUDE(file.path));

  it('renderer/**/*.{ts,tsx}: zero prose-shaped literals outside lib/copy/', () => {
    const offenders = rendererFiles
      .map((file) => ({ file, violations: findProseLiterals(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file.path}: ${entry.violations.join(', ')}`),
      'A player-facing literal inlined outside lib/copy/ means a screen that is English no ' +
        'matter what language the player chose.',
    ).toEqual([]);
  });

  it('src/main/**/*.ts: zero prose-shaped literals', () => {
    const offenders = mainFiles
      .map((file) => ({ file, violations: findProseLiterals(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file.path}: ${entry.violations.join(', ')}`),
      'A player-facing literal inlined in the main process means a screen that is English no ' +
        'matter what language the player chose — main already speaks in codes ' +
        '(AccountStoreReason, SectionStatus, …); a new English sentence here is a regression.',
    ).toEqual([]);
  });

  it('red state demonstrated (.tsx): inlining one string is caught, by path and by value', () => {
    const offenders = [{ path: 'fixture.tsx', source: '<EmptyState title="Nothing saved yet" />' }]
      .map((file) => ({ file, violations: findProseLiterals(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.file.path).toBe('fixture.tsx');
    expect(offenders[0]?.violations).toEqual(['Nothing saved yet']);
  });

  it('red state demonstrated (.ts): inlining one template literal is caught, by path and by value', () => {
    // NOT inside new Error(...)/console.*(...)/log.*(...) — those are the deliberate, documented
    // exclusions above (diagnostic text, never rendered). A bare returned/assigned template
    // literal is exactly format.ts's own pre-F4 shape (design §2.3) and must still be caught.
    const offenders = [{ path: 'fixture.ts', source: 'export function label() { return `Game not running right now`; }' }]
      .map((file) => ({ file, violations: findProseLiterals(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.file.path).toBe('fixture.ts');
    expect(offenders[0]?.violations).toEqual(['Game not running right now']);
  });

  it('the Error()/console.*/log.*/execSync()/​.write() exclusions do not blanket-exempt a REAL two-word literal placed elsewhere in the same file', () => {
    // Guards against the exclusion rule being too broad — it only skips the literal that is the
    // ARGUMENT of one of those calls, not every literal in a file that happens to also call them.
    const offenders = [
      {
        path: 'fixture.ts',
        source: "console.log('technical detail'); export const shellLabel = 'Not translated yet';",
      },
    ]
      .map((file) => ({ file, violations: findProseLiterals(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.violations).toEqual(['Not translated yet']);
  });
});

// ---------------------------------------------------------------------------------------------
// Guard 2 — the pinned exception table
// ---------------------------------------------------------------------------------------------

interface PinnedException {
  readonly text: string;
  readonly owner: string;
  readonly permittedBy: string;
  readonly reachable: boolean;
}

/**
 * Every English string the desktop renders (or could render) but cannot translate, because
 * fixing it means editing a file this feature must not touch. Fails if the list WIDENS (a new
 * untranslated string reachable from the desktop) and fails if it is SILENTLY CLOSED (an entry
 * that no longer exists in its owning file, i.e. someone fixed it upstream without updating this
 * record) — applied to an i18n boundary.
 */
const PINNED_EXCEPTIONS: readonly PinnedException[] = [
  {
    // The nav landmark, and its default accessible name, moved out of AppShell.tsx into the
    // shared AppNav primitive it now composes — same hardcoded "Main", new owning file.
    text: "ariaLabel = 'Main'",
    owner: join(REPO_ROOT, 'packages', 'ui', 'src', 'app-nav.tsx'),
    permittedBy: 'the pinned literal-exception list — packages/ui may not change (reuse boundary)',
    reachable: true,
  },
  {
    text: 'aria-label="Increment"',
    owner: join(REPO_ROOT, 'packages', 'ui', 'src', 'num.tsx'),
    permittedBy: 'the pinned literal-exception list',
    reachable: true,
  },
  {
    text: 'aria-label="Decrement"',
    owner: join(REPO_ROOT, 'packages', 'ui', 'src', 'num.tsx'),
    permittedBy: 'the pinned literal-exception list',
    reachable: true,
  },
  {
    text: 'aria-label="Dismiss"',
    owner: join(REPO_ROOT, 'packages', 'ui', 'src', 'toast-system.tsx'),
    permittedBy: 'the pinned literal-exception list — the desktop renders no toast today; reachable: false so mounting one later is a test failure, not a silent regression',
    reachable: false,
  },
];

describe('Guard 2 — the pinned packages/ui exception table', () => {
  it('every reachable exception still exists verbatim in its owning file — a widened list is a failure', () => {
    // "Widens" is proven the other direction here: this table IS the allowlist. A new untranslated
    // string reachable from the desktop is caught by Guard 1 above (it scans renderer + main, and
    // packages/ui/apps/web are out of its scan root entirely — so the only way a NEW packages/ui
    // exception could reach the desktop unnoticed is if it were added to THIS table without
    // Guard 1 ever having flagged it, which cannot happen: Guard 1 does not scan packages/ui at
    // all, by design (the reuse boundary) — the width of this specific table is instead bounded by
    // hand, reviewed at PR time.
    expect(PINNED_EXCEPTIONS.length).toBe(4);
  });

  it('each pinned entry is verbatim in its owning file, or is correctly marked as no longer reachable', () => {
    const stale: string[] = [];
    for (const exception of PINNED_EXCEPTIONS) {
      let source: string;
      try {
        source = readFileSync(exception.owner, 'utf8');
      } catch {
        stale.push(`${exception.text}: owning file ${exception.owner} does not exist`);
        continue;
      }
      if (!source.includes(exception.text)) {
        stale.push(`${exception.text}: no longer found in ${exception.owner} — the exception record is stale`);
      }
    }
    expect(
      stale,
      'An exception entry no longer matches its owning file — either it was fixed upstream ' +
        '(remove the row) or the file moved (update the path). A silently stale record hides a ' +
        'real fix instead of reporting it.',
    ).toEqual([]);
  });

  it('red state demonstrated: a pinned entry with a deliberately wrong owning-file path is caught (widening/staleness check)', () => {
    const fixtureExceptions: readonly PinnedException[] = [
      { text: 'aria-label="Main"', owner: join(REPO_ROOT, 'packages', 'ui', 'src', 'does-not-exist.tsx'), permittedBy: 'x', reachable: true },
    ];
    const stale: string[] = [];
    for (const exception of fixtureExceptions) {
      try {
        readFileSync(exception.owner, 'utf8');
      } catch {
        stale.push(exception.text);
      }
    }
    expect(stale).toEqual(['aria-label="Main"']);
  });
});

// ---------------------------------------------------------------------------------------------
// Guard 2b — the consent disclosure is bilingual, not exempt
// ---------------------------------------------------------------------------------------------

/**
 * The consent disclosure used to be a pinned Guard 2 exception: English only, by a recorded
 * decision that a translated rendering could constitute wording the player never actually agreed
 * to. That decision no longer holds — the disclosure is locale-keyed now, and the consent record
 * traces a past agreement to the exact language it was shown in instead. This guard pins the shape
 * that reversal depends on: both languages present, both bound to the one version number the
 * record stamps, matched in structure, and never accidentally the same text.
 */
describe('Guard 2b — CONSENT_TEXT is bilingual, both locales tied to one version', () => {
  it('both en and pt-BR entries exist', () => {
    expect(CONSENT_TEXT.en).toBeDefined();
    expect(CONSENT_TEXT['pt-BR']).toBeDefined();
  });

  it('both are stamped with the one version the consent record stores', () => {
    expect(CONSENT_TEXT.en.version).toBe(CONSENT_TEXT_VERSION);
    expect(CONSENT_TEXT['pt-BR'].version).toBe(CONSENT_TEXT_VERSION);
  });

  it('both carry the same number of clauses', () => {
    expect(CONSENT_TEXT['pt-BR'].body.length).toBe(CONSENT_TEXT.en.body.length);
  });

  it('pt-BR is not accidentally the en text', () => {
    expect(CONSENT_TEXT['pt-BR'].title).not.toBe(CONSENT_TEXT.en.title);
    const flatten = (text: ConsentText): string =>
      text.body.map((clause) => `${clause.heading}\n${clause.text}`).join('\n');

    expect(flatten(CONSENT_TEXT['pt-BR'])).not.toBe(flatten(CONSENT_TEXT.en));
  });
});

// ---------------------------------------------------------------------------------------------
// Guard 3 — i18next appears nowhere (the spec's own success criterion)
// ---------------------------------------------------------------------------------------------

describe('Guard 3 — i18next/react-i18next appear nowhere (E4 stays closed)', () => {
  it('zero occurrences across every package.json, pnpm-lock.yaml, and every .ts/.tsx/.mjs/.json source file', () => {
    const packageJsonFiles = walk(REPO_ROOT, ['.json']).filter(
      (path) => path.endsWith(`${sep}package.json`) || path === join(REPO_ROOT, 'package.json'),
    );
    const lockfile = join(REPO_ROOT, 'pnpm-lock.yaml');
    const sourceFiles = walk(REPO_ROOT, ['.ts', '.tsx', '.mjs']).filter((path) => path !== SELF_PATH);

    const offenders: string[] = [];
    for (const path of [...packageJsonFiles, lockfile, ...sourceFiles]) {
      let source: string;
      try {
        source = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      if (/i18next/i.test(source)) {
        offenders.push(path);
      }
    }
    expect(
      offenders,
      'i18next / react-i18next found. The decision to adopt the planner\'s typed strings map ' +
        'instead means bringing this library back would reopen epic OQ E4, which that decision closed. ' +
        'The planner\'s typed map is the mechanism; this is the executable form of "E4 is closed".',
    ).toEqual([]);
  });

  it('red state demonstrated: an i18next reference in a fixture string is caught', () => {
    expect(/i18next/i.test("import i18next from 'i18next';")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Guard 4 — no literal `lang` argument to any game-labels helper
// ---------------------------------------------------------------------------------------------

/** Every exported helper in packages/domain/src/game-labels.ts that takes a `lang: Lang` (or
 *  `lvLabel`-adjacent) second argument. */
const GAME_LABELS_HELPERS = [
  'abilityName',
  'abilityEffectText',
  'rarityLabel',
  'itemRarityLabel',
  'houseLabel',
  'slotLabel',
  'statLabel',
  'teamBuffLabel',
  'itemStatLabel',
  'propLabel',
  'setName',
  'formatItemDisplay',
  'formatItemRosterTooltip',
] as const;

function findLiteralLangArgs(source: string): string[] {
  const stripped = stripComments(source);
  const offenders: string[] = [];
  for (const helper of GAME_LABELS_HELPERS) {
    // helper(<anything not containing a top-level close-paren>, 'en'|'pt' ...) — a dumb-but-
    // sufficient scan: it looks for the helper name followed by a call whose SECOND argument is
    // the literal 'en' or 'pt'. Deliberately permissive about the first argument's shape (it may
    // itself contain commas, e.g. an object) by only requiring the literal to appear as a
    // comma-then-quoted-en/pt-then-comma-or-paren sequence somewhere after the helper name.
    const pattern = new RegExp(`\\b${helper}\\s*\\([^)]*,\\s*['"](en|pt)['"]\\s*[,)]`, 'g');
    for (const match of stripped.matchAll(pattern)) {
      const lang = match[1] ?? '?';
      offenders.push(`${helper}(..., '${lang}')`);
    }
  }
  return offenders;
}

describe("Guard 4 — no game-labels helper ever receives a literal 'en'/'pt' lang argument (docs/i18n.md rule 4)", () => {
  const desktopFiles = readAll(DESKTOP_ROOT, ['.ts', '.tsx']);

  it('apps/desktop/**: zero literal lang arguments to any game-labels helper', () => {
    const offenders = desktopFiles
      .map((file) => ({ file, violations: findLiteralLangArgs(file.source) }))
      .filter((entry) => entry.violations.length > 0);
    expect(
      offenders.map((entry) => `${entry.file.path}: ${entry.violations.join(', ')}`),
      "toDomainLang is the ONE place the 'pt-BR' -> 'pt' mapping is written (docs/i18n.md rule " +
        "4). A literal 'en'/'pt' at a call site is a second, unreviewable mapping — the " +
        'exact defect this guard exists to make impossible to add.',
    ).toEqual([]);
  });

  it("red state demonstrated: a restored literal ('en') is caught", () => {
    const fixtureSource = "rarityLabel(entry.hero.rarity, 'en')";
    expect(findLiteralLangArgs(fixtureSource)).toEqual(["rarityLabel(..., 'en')"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Guard 5 — the account layer is locale-free, so a language change causes no refresh or recompute
// ---------------------------------------------------------------------------------------------

describe('Guard 5 — renderer/lib/account/** never mentions locale (no recompute on language change, structural half)', () => {
  const ACCOUNT_ROOT = join(RENDERER_ROOT, 'lib', 'account');
  const accountFiles = readAll(ACCOUNT_ROOT, ['.ts', '.tsx'], { includeTests: true });

  it('zero occurrences of "locale" (case-insensitive) under renderer/lib/account/**', () => {
    const offenders = accountFiles
      .filter((file) => /locale/i.test(stripComments(file.source)))
      .map((file) => file.path);
    expect(
      offenders,
      'A "locale" reference under renderer/lib/account/** means a language switch could enter ' +
        'a memo dependency or a change key — breaking the no-recompute-on-irrelevant-change ' +
        'guarantee from the other side, silently, with everything still looking right.',
    ).toEqual([]);
  });

  it('red state demonstrated: a fixture file mentioning "locale" is caught', () => {
    const fixtureSource = 'export function f(locale: string) { return locale; }';
    expect(/locale/i.test(fixtureSource)).toBe(true);
  });
});
