/**
 * The corpus's captures are named `save-YYYYMMDD-...` / `payload-YYYYMMDD-...` (see
 * `fixtures/sheet-math/README.md`, `fixtures/farm-rate/README.md`), and the game has moved
 * through several balance regimes since the earliest ones were taken. A test that reads a capture
 * to check STRUCTURE (does it parse, does the roster have the right shape) survives a regime
 * change; a test that asserts a specific NUMBER off the same capture does not — the number was
 * true of the game on the capture's date, and nothing says so on the test itself.
 *
 * This module is where the corpus's regime knowledge lives, in one place instead of one
 * hand-maintained list per suite. It answers two questions mechanically:
 *
 * 1. **Which regime was a capture taken under?** {@link CAPTURE_REGISTRY} — one row per committed
 *    capture, with the date, whether it may still back a value assertion, and why.
 * 2. **Is this capture admissible for the claim I am about to assert?**
 *    {@link isInRegimeFor} / {@link skipUnlessInRegime} / {@link assertInRegime}, resolved against
 *    {@link MECHANICS} rather than against a date the calling test hard-codes.
 *
 * WHY PER-MECHANIC AND NOT ONE GLOBAL CUTOFF: this repo has lived through four regime boundaries
 * in ten days ({@link REGIME_BOUNDARIES}) and they do not collapse into one date — the item
 * catalog settled on 2026-08-18 while the crit-chance abilities did not move until 2026-08-23. A
 * suite names the MECHANIC its numbers depend on and gets that mechanic's boundary; it never
 * repeats a date, so the next patch is one edit here rather than a sweep of every suite.
 *
 * WHY THE STRUCTURAL / VALUE SPLIT IS THE WHOLE DESIGN (issue #137): a capture leaving its regime
 * does not stop being a real account. Its hero shapes, gear shapes, inventory and team-plan inputs
 * are as true as the day it was taken, and ~50 structural suites read it for exactly those. What
 * expires is only the arithmetic. So an out-of-regime capture stays committed and stays readable,
 * and what this module withdraws is its admissibility as the SOURCE OF A NUMBER.
 */
import { beforeEach, type TestContext } from 'vitest';

// `(?:^|[/\\])` rather than `(?:^|\/)`: callers build the `dir/filename` shape with `path.join`,
// which emits `\` on Windows, and this repo is developed and CI'd on Windows.
const CAPTURE_DATE_PATTERN = /(?:^|[/\\])(?:save|payload)-(\d{4})(\d{2})(\d{2})-/;

/**
 * Throws rather than returning `undefined` on a name it cannot parse: a silent `undefined` here
 * would make {@link isBefore} vacuously `false` for a typo'd or non-capture filename, which is
 * the false-all-clear this module exists to avoid elsewhere.
 */
export function captureDateOf(fixtureName: string): string {
  const match = CAPTURE_DATE_PATTERN.exec(fixtureName);
  if (!match) {
    throw new Error(
      `capture-regime: "${fixtureName}" does not carry a "save-YYYYMMDD-" or "payload-YYYYMMDD-" ` +
        'capture date. Only fixtures named that way can be regime-checked this way.',
    );
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

export function isBefore(fixtureName: string, regimeBoundary: string): boolean {
  // Both sides are zero-padded YYYY-MM-DD, so lexicographic string comparison is date comparison.
  return captureDateOf(fixtureName) < regimeBoundary;
}

/**
 * Every balance patch that reshaped sheet arithmetic, and what it moved. The dates here are the
 * only place a boundary is written down; {@link MECHANICS} points at them by key, so a mechanic
 * can never carry a date this table does not know about.
 */
export const REGIME_BOUNDARIES = {
  '2026-08-15': 'crit chance and cooldown reduction were restated from percent-of-base to flat addends',
  '2026-08-16': 'the item stat redistribution reshuffled 239 of 240 slot definitions',
  '2026-08-18':
    'crit chance and cooldown reduction were restated BACK to percent-of-base, and the item ' +
    "catalog's crit/cooldown bases were rescaled by the same factor",
  '2026-08-23': 'Olho Clinico and Pressagio Mortal were restated from percent-of-roll to flat crit POINTS',
  '2026-08-28':
    'weapons gained a flat 5x on the Dano ladder (`itens.arma_dmg_mult`), and the ladder itself '  +
    'gained a step every 50 item levels (`itens.dmg_step_niveis`) - 186 of 240 def Dano values moved',
} as const;

export type RegimeBoundary = keyof typeof REGIME_BOUNDARIES;

/**
 * The abilities the 2026-08-23 patch restated. A capture predating that boundary on which NO hero
 * owns either one is untouched by it — which is what {@link CaptureRow.waivers} claims and
 * `capture-regime-registry.test.ts` verifies against the capture's own heroes rather than
 * believing the prose.
 */
export const ABILITIES_RESTATED_2026_08_23 = ['olho_clinico', 'pressagio_mortal'] as const;

/**
 * What a value assertion can be ABOUT, and the boundary each one's numbers must be at or past.
 *
 * `sheet` is the catch-all and deliberately the strictest: a composed hero sheet folds in every
 * other mechanic, so anything derived from one — throughput, farm ranking, team plans, respec
 * advice — asks for `sheet` and gets the latest boundary of the lot.
 */
export const MECHANICS = {
  critChance: {
    since: '2026-08-23',
    what: "the crit-chance column's ability term",
  },
  critDamage: {
    since: '2026-08-23',
    what: "the crit-damage column's ability term",
  },
  cooldown: {
    since: '2026-08-18',
    what: 'the cooldown column and the item catalog cooldown bases',
  },
  itemStats: {
    since: '2026-08-18',
    what: 'which stats each gear slot rolls, and at what base',
  },
  itemDamage: {
    since: '2026-08-28',
    what: 'the Dano a gear item contributes, and how it scales with item level',
  },
  sheet: {
    since: '2026-08-28',
    what: 'a whole composed hero sheet, or anything derived from one (throughput, ranking, team plans)',
  },
} as const satisfies Record<string, { since: RegimeBoundary; what: string }>;

export type Mechanic = keyof typeof MECHANICS;

export const ALL_MECHANICS = Object.keys(MECHANICS) as Mechanic[];

/**
 * `value` — the capture is at or past at least one mechanic's boundary, so it may be the source
 * of a number for those mechanics.
 *
 * `structural` — the capture is behind every boundary. It stays committed and stays readable for
 * shape, parse, roster and inventory coverage, and this module refuses it as the source of a
 * number for every mechanic.
 */
export type Retention = 'value' | 'structural';

export type CaptureRow = {
  /**
   * The date the capture was taken. Cross-checked against the filename's own `-YYYYMMDD-` where
   * the filename carries one; written out here because three governed captures
   * (`fidelity-gate/`, `api/`) do not follow that naming convention and would otherwise have no
   * machine-readable date at all.
   */
  capturedOn: string;
  retention: Retention;
  /**
   * Mechanics this capture is admissible for DESPITE predating their boundary, each with the
   * precondition that makes it so. Not a note: `capture-regime-registry.test.ts` re-derives every
   * waiver's precondition from the capture's own heroes and fails if it does not hold.
   */
  waivers?: Partial<Record<Mechanic, string>>;
  note: string;
};

/**
 * One row per committed capture, keyed by its path relative to `packages/domain/tests/fixtures/`.
 *
 * COMPLETENESS IS ENFORCED, NOT INTENDED: `capture-regime-registry.test.ts` walks the fixture tree
 * and fails in both directions — a committed capture with no row, and a row naming a file that no
 * longer exists. A capture landing here without a declared regime is the failure this registry
 * exists to make impossible.
 */
export const CAPTURE_REGISTRY: Record<string, CaptureRow> = {
  'sheet-math/save-20260813-5heroes.json': {
    capturedOn: '2026-08-13',
    retention: 'structural',
    note:
      'Predates every boundary below. Read by ~50 structural suites for its 5-hero roster shape ' +
      '(2 geared, 3 naked) and as the fidelity-gate export half.',
  },
  'sheet-math/payload-20260812-8heroes.json': {
    capturedOn: '2026-08-12',
    retention: 'structural',
    note:
      'An AccountPayload from a disjoint account, not a save export. Post-wipe by content (it ' +
      "carries the positive discriminator keys) but behind every arithmetic boundary; read for " +
      'its 8-hero payload shape.',
  },
  'sheet-math/save-20260818-12heroes.json': {
    capturedOn: '2026-08-18',
    retention: 'value',
    note:
      'The first whole-roster witness for the reverted percent-of-base crit/cooldown shape. Four ' +
      'item-free, ability-free heroes isolate the tree term; three rank-20 olho_clinico heroes ' +
      'put it behind the 2026-08-23 boundary for the two crit mechanics.',
  },
  'sheet-math/save-20260819-respec-crit-cdr.json': {
    capturedOn: '2026-08-19',
    retention: 'value',
    note:
      'The per-point-rate witness: Sora respecced 10 attack points into 5 crit chance + 5 ' +
      'cooldown, no items and no crit/cooldown ability, both moves +0.1 over 5 points. Carries ' +
      'rank-20 olho_clinico heroes, so the two crit mechanics stay behind 2026-08-23.',
  },
  'sheet-math/save-20260819-11882-7heroes.json': {
    capturedOn: '2026-08-19',
    retention: 'value',
    waivers: {
      critChance: 'no hero owns olho_clinico or pressagio_mortal, so the 2026-08-23 restatement cannot reach this roster',
      critDamage: 'no hero owns olho_clinico or pressagio_mortal, so the 2026-08-23 restatement cannot reach this roster',
      // The `sheet` waiver this row used to carry is GONE: it excused only the 2026-08-23
      // ability restatement, and 2026-08-28 moved the mechanic's boundary past it for a reason
      // that reaches every roster with a weapon on it. Five of these seven heroes wear one.
    },
    note:
      'A second, disjoint account (7 heroes: 5 geared, 2 naked; Comum/Incomum/Raro), and the only ' +
      'in-regime capture that is not account 486 — so it is what makes a claim cross-account ' +
      'rather than about one build. All 7 import clean, wearing 40 items between them. Also the ' +
      'only capture carrying fortuna at two different ranks (Ivo 20/20, Gale 8/20).',
  },
  'sheet-math/save-20260822-15heroes-tree-crit-dmg.json': {
    capturedOn: '2026-08-22',
    retention: 'value',
    note:
      "The skill tree's crit-damage term on 15 heroes. Behind the 2026-08-23 boundary for the two " +
      'crit mechanics.',
  },
  'sheet-math/save-20260823-13heroes-crit-points.json': {
    capturedOn: '2026-08-23',
    retention: 'value',
    note:
      'The first capture taken after the crit-chance ability restatement. Perrin (olho_clinico ' +
      '13/20, no gear, no crit-chance points) pins the flat addend on his own.',
  },
  'sheet-math/save-20260825-11heroes-one-shot-spread.json': {
    capturedOn: '2026-08-25',
    retention: 'value',
    note:
      'The one-shot SPREAD: nine geared late-level heroes that one-shot a phase-42 prop and two ' +
      'naked young ones (Hale L2, Joric L5) that do not, on a roster carrying three rank-20 ' +
      'olho_clinico heroes. The only committed capture holding both sides of that contrast.',
  },
  'sheet-math/save-20260828-4heroes-postpatch.json': {
    capturedOn: '2026-08-28',
    retention: 'value',
    note:
      'The only capture past the 2026-08-28 damage boundary, and the witness that the weapon 5x ' +
      'is the GAME and not just the wiki: two heroes wear an ember_arma exporting value 96.25 ' +
      'where the pre-patch ladder said 19.25, and all four heroes invert with no issue. A fresh ' +
      'account, so it is thin on purpose-adjacent coverage: every item is level 10 (where the ' +
      '50-level Dano step is 1, leaving that half of the boundary WITHOUT a committed witness), ' +
      'every upgrade is 0, every hero is star-0, and max_phase is 21.',
  },
  'farm-rate/save-20260815-486-7heroes.json': {
    capturedOn: '2026-08-15',
    retention: 'structural',
    note:
      'Retired as a throughput anchor (issue #137) — its recorded item crit rolls read 0.0616 ' +
      "against the shipped catalog's 0.00644023. Retained for the divergence it witnesses: a " +
      'roster overcommitting its House, and field_slots disagreeing with both casa.slots and ' +
      'skills.totals.vagas_campo.',
  },
  'fidelity-gate/export-capture.json': {
    capturedOn: '2026-08-13',
    retention: 'structural',
    note: 'A byte-identical pin of sheet-math/save-20260813-5heroes.json — one capture, two checked copies; same regime as it.',
  },
  'fidelity-gate/live-capture.json': {
    capturedOn: '2026-08-13',
    retention: 'structural',
    note: "The paired live-memory read for export-capture.json — the fidelity gate's only subject.",
  },
  'api/assembled-payload-before.json': {
    capturedOn: '2026-08-12',
    retention: 'structural',
    note: 'Generated from the 2026-08-12 payload by generate-domain-fixtures.mjs; same regime as its source.',
  },
  'api/assembled-payload-after.json': {
    capturedOn: '2026-08-12',
    retention: 'structural',
    note: 'Generated from the 2026-08-12 payload by generate-domain-fixtures.mjs; same regime as its source.',
  },
  'api/assembled-payload-partial.json': {
    capturedOn: '2026-08-12',
    retention: 'structural',
    note: 'Generated from the 2026-08-12 payload by generate-domain-fixtures.mjs; same regime as its source.',
  },
  'api/assembled-payload-drift.json': {
    capturedOn: '2026-08-12',
    retention: 'structural',
    note: 'Generated from the 2026-08-12 payload by generate-domain-fixtures.mjs; same regime as its source.',
  },
};

function rowFor(capturePath: string): CaptureRow {
  const key = capturePath.replace(/\\/g, '/');
  const row = CAPTURE_REGISTRY[key];
  if (!row) {
    throw new Error(
      `capture-regime: "${key}" has no CAPTURE_REGISTRY row. Every committed capture declares the ` +
        'regime it was taken under before any test may assert a number off it — add a row in ' +
        'helpers/capture-regime.ts (path relative to tests/fixtures/).',
    );
  }
  return row;
}

export function captureRow(capturePath: string): CaptureRow {
  return rowFor(capturePath);
}

/**
 * Whether `capturePath` may be the source of a number about `mechanic`. `true` when the capture
 * is at or past that mechanic's boundary, or carries a verified waiver for it.
 */
export function isInRegimeFor(capturePath: string, mechanic: Mechanic): boolean {
  const row = rowFor(capturePath);
  if (row.capturedOn >= MECHANICS[mechanic].since) return true;
  return row.waivers?.[mechanic] !== undefined;
}

/** Every registered capture that may NOT be the source of a number about `mechanic`, sorted. */
export function capturesOutOfRegimeFor(mechanic: Mechanic): string[] {
  return Object.keys(CAPTURE_REGISTRY)
    .filter((path) => !isInRegimeFor(path, mechanic))
    .sort();
}

function expiryMessage(capturePath: string, mechanic: Mechanic): string {
  const row = rowFor(capturePath);
  const { since, what } = MECHANICS[mechanic];
  return (
    `${capturePath} was captured ${row.capturedOn}; ${mechanic} numbers need a capture at or past ` +
    `${since}, when ${REGIME_BOUNDARIES[since]}. This capture cannot speak for ${what} — its ` +
    'numbers are EXPIRED, not verified: nobody has re-checked them against the current game.'
  );
}

/**
 * A runtime `context.skip()`, not a `.skip(...)` literal — needs no entry in the static skip
 * manifests (`tools/fixture-corpus-parity.test.mjs`, `source-surface.test.ts`), which police
 * skips nobody explained; the explanation here is generated from the registry instead.
 *
 * Use this inside a test body. For a module-scope loader, where there is no `TestContext` to skip
 * and a wrong fixture would silently feed every test in the file, use {@link assertInRegime}.
 */
export function skipUnlessInRegime(ctx: TestContext, capturePath: string, mechanic: Mechanic): void {
  ctx.skip(!isInRegimeFor(capturePath, mechanic), expiryMessage(capturePath, mechanic));
}

/**
 * The whole-suite form, for a value suite whose capture has expired and for which NO admissible
 * capture exists in the corpus yet.
 *
 * WHY THIS IS NOT THE QUIET SKIP {@link assertInRegime} EXISTS TO PREVENT. That function is the
 * right answer when an admissible capture exists and the suite is pointed at the wrong one: the
 * fix is a one-line re-point, and failing loudly is what prompts it. It is the wrong answer when
 * the corpus holds nothing the suite could be re-pointed AT, because then "fail loudly" is a
 * standing red that no one can clear, and a standing red is how a suite stops being read.
 *
 * The 2026-08-28 damage boundary put the corpus in exactly that state: every committed capture
 * but one has an equipped weapon, and the one that does not is a fresh account too thin to carry
 * a gear planner or a phase-52 band. So these suites are held, not deleted, and they come back on
 * their own the moment a capture past the boundary lands with the roster they need.
 *
 * It is a runtime `ctx.skip()` for the same reason {@link skipUnlessInRegime} is: a `.skip(...)`
 * literal would need an entry in the static skip manifests, and the reason here is generated from
 * the registry rather than restated by hand. The skip is COUNTED and its message names the
 * capture and the boundary, so a held suite is visible in every run.
 */
export function holdSuiteUntilInRegime(capturePath: string, mechanic: Mechanic): void {
  beforeEach((ctx: TestContext) => {
    skipUnlessInRegime(ctx, capturePath, mechanic);
  });
}

/**
 * The throwing form. A value-asserting suite that picks its capture at module scope has no test to
 * skip yet, and defaulting to "run anyway" there is exactly the quiet pass this module exists to
 * prevent — so this fails the file loudly instead.
 */
export function assertInRegime(capturePath: string, mechanic: Mechanic): void {
  if (!isInRegimeFor(capturePath, mechanic)) throw new Error(`capture-regime: ${expiryMessage(capturePath, mechanic)}`);
}

/**
 * @deprecated Prefer {@link skipUnlessInRegime}, which resolves the boundary from
 * {@link MECHANICS} instead of asking each caller to repeat a date. Kept for
 * `capture-regime-expiry.test.ts`, which proves the date comparison itself and therefore has to
 * state both sides of it by hand.
 */
export function skipIfBefore(ctx: TestContext, fixtureName: string, regimeBoundary: string, reason: string): void {
  const capturedOn = captureDateOf(fixtureName);
  ctx.skip(
    capturedOn < regimeBoundary,
    `${fixtureName} was captured ${capturedOn}, before ${regimeBoundary} — ${reason} This capture's ` +
      'numbers are EXPIRED, not verified: nobody has re-checked them against the current game.',
  );
}
