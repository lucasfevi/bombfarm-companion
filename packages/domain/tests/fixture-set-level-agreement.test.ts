import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import catalog from '@bombfarm/domain/data/catalog.json';
import { setsForLevel } from '@bombfarm/domain/gear';

/**
 * #106 — the premise, guarded at the fixture level.
 *
 * The slot editor no longer offers a set control: it prints the set name inside the LEVEL option's
 * own label, because `catalog.setsByLevel` is a bijection (asserted in `gear-catalog-bijection.test.ts`).
 * That makes one level mean exactly one set, and it makes any fixture holding an equipped item whose
 * definition belongs to a DIFFERENT set than its level implies a state the planner can no longer
 * render honestly — it would draw the level's set name over an item from another one.
 *
 * This walks the committed fixture tree and fails on any such item. It is the fixture-side
 * counterpart to the catalog-side bijection guard: that one proves the map has one set per level,
 * this one proves the committed data agrees with the map.
 *
 * Mirrors `fixture-corpus.test.ts`'s directory-walk shape, widened to the whole repository —
 * the seed saves this is really about live under `apps/`, not under this package.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..');

/** The one seed save that carries equipped gear today — named so a rename fails loudly. */
const SEED_SAVE = 'apps/web/e2e/fixtures/sample-save.json';

/**
 * DATED CAPTURES — excluded, with the reason, the same way `fixture-corpus.test.ts` excludes
 * `rejection/pre-update-save.json` by name rather than by widening its rule.
 *
 * Each entry is a capture of the live game on a recorded date, and every one of those dates falls
 * BEFORE the 2026-08-15 patch that re-keyed the whole level→set map (it moved every one of the 30
 * levels). Pre-patch, level 10 legitimately carried `wooden` / `forest` items; post-patch it
 * carries `ember`. Those files are therefore correct records of what the game returned when they
 * were taken, not stale data to repair — and repairing them is not an option in any case:
 * `fixtures/sheet-math/README.md` records a SHA-256 for each capture together with the claim that
 * scrubbing changed nothing else, so editing one would falsify recorded evidence.
 *
 * The distinction this list draws is capture vs. authored, not old vs. new: an AUTHORED fixture
 * (a hand-written seed save) asserts what the game does now and must track the current map; a
 * CAPTURE asserts what the game did on its capture date and must never be rewritten.
 */
const DATED_CAPTURES = [
  'apps/web/src/tests/fixtures/sheet-math',
  'packages/domain/tests/fixtures/api',
  'packages/domain/tests/fixtures/farm-rate',
  'packages/domain/tests/fixtures/fidelity-gate',
  'packages/domain/tests/fixtures/sheet-math',
  'packages/game-api/src/__fixtures__',
  'packages/game-data/fixtures/inventory-bag-v2.json',
] as const;

// `.claude` holds agent worktrees — each a full checkout of some other branch, carrying its own
// copy of the fixture tree. Walking into them checks stale fixtures from unrelated branches
// against the current catalog, which fails locally while CI (a fresh clone) stays green.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.claude',
  'dist',
  'out',
  '.next',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
]);

function listJsonFiles(dir: string, acc: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listJsonFiles(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.json')) acc.push(full);
  }
  return acc;
}

const toPosix = (file: string) => relative(ROOT, file).replace(/\\/g, '/');
const isCapture = (path: string) =>
  DATED_CAPTURES.some((entry) => path === entry || path.startsWith(`${entry}/`));

const fixtureFiles = listJsonFiles(ROOT)
  .map(toPosix)
  .filter((path) => /(^|\/)(fixtures|__fixtures__)\//.test(path))
  .filter((path) => !isCapture(path))
  .sort();

const definitionById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

type LooseItem = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Every `items: [...]` array anywhere in the document — save exports and API payloads nest differently. */
function collectItemArrays(node: unknown, acc: LooseItem[][] = []): LooseItem[][] {
  if (Array.isArray(node)) {
    for (const child of node) collectItemArrays(child, acc);
    return acc;
  }
  if (!isObject(node)) return acc;
  if (Array.isArray(node.items)) acc.push(node.items.filter(isObject));
  for (const value of Object.values(node)) collectItemArrays(value, acc);
  return acc;
}

type Checked = { file: string; defId: string; set: string; level: number; expected: string | undefined };

function scan() {
  const checked: Checked[] = [];
  for (const path of fixtureFiles) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
    } catch {
      continue; // not every fixture is a document this guard understands
    }
    for (const items of collectItemArrays(parsed)) {
      for (const item of items) {
        const defId = item.def_id;
        // Equipped only: a stashed item is not rendered through the level→set label.
        if (typeof defId !== 'string' || item.equipped_on == null || item.equipped_on === '') continue;
        // Non-gear consumables (time parts, map keys, …) share the `items` array but have no
        // catalog definition and no set. Resolving through `catalog.defs` is what excludes them.
        const definition = definitionById.get(defId);
        if (!definition) continue;
        const level = typeof item.level === 'number' ? item.level : Number.NaN;
        checked.push({
          file: path,
          defId,
          set: definition.set,
          level,
          expected: setsForLevel(level)[0],
        });
      }
    }
  }
  return checked;
}

describe('committed fixtures agree with the level→set map (#106)', () => {
  const checked = scan();

  it('every excluded dated-capture path still exists — a stale entry silently widens the scan', () => {
    const dangling = DATED_CAPTURES.filter((entry) => !existsSync(join(ROOT, entry)));
    expect(dangling, `exclusion entries naming a path that is gone: ${dangling.join(', ')}`).toEqual([]);
  });

  it('non-vacuity: the walk found fixture files, and equipped gear inside them', () => {
    expect(fixtureFiles.length, `walked ${ROOT} for fixture JSON`).toBeGreaterThan(0);
    expect(
      checked.length,
      `scanned ${fixtureFiles.length} fixture files and found no equipped gear at all — a broken walk or filter would pass this suite silently`,
    ).toBeGreaterThan(0);
  });

  it(`non-vacuity: the seed save ${SEED_SAVE} is in scope and contributes equipped gear`, () => {
    expect(fixtureFiles, 'seed save missing from the walk').toContain(SEED_SAVE);
    const fromSeed = checked.filter((entry) => entry.file === SEED_SAVE);
    expect(fromSeed.length, `equipped gear items read from ${SEED_SAVE}`).toBeGreaterThan(0);
  });

  it('no equipped gear item belongs to a set other than the one its level implies', () => {
    const offenders = checked
      .filter((entry) => entry.set !== entry.expected)
      .map(
        (entry) =>
          `${entry.file}: ${entry.defId} is set "${entry.set}" but level ${entry.level} implies "${entry.expected ?? '(no set for this level)'}"`,
      );
    expect(offenders, `fixtures disagreeing with catalog.setsByLevel:\n${offenders.join('\n')}`).toEqual([]);
  });
});
