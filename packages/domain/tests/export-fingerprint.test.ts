/**
 * MP5 F4 (T4) — the export corpus check and its three named red states.
 *
 * The spec's sharpest finding (spec.md Problem Statement) is that the PREVIOUS route fingerprint
 * was authored from an already-drifted capture and its only cross-check was a subset assertion —
 * unfalsifiable on either an addition or a removal. This suite runs the opposite check: equality
 * modulo the fingerprint's own named allowance, over the real committed export corpus, with the
 * key sets written down as literals in save-schema.ts (never derived from the artifact here).
 *
 * The corpus itself is DISCOVERED, not hand-listed: `tests/fixtures/sheet-math/` is walked at run
 * time (same idiom as `fixture-corpus.test.ts` and `points-within-level-budget.test.ts`), so a
 * newly ingested save-export capture is swept automatically. A single hardcoded corpus file has a
 * blind spot the "unfalsifiable subset check" story above does not name: a new capture with a
 * different key set can be committed and no test ever feeds it to `checkSchema` — the invariant
 * holds by luck, not by test. The sweep below closes that.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  assertNonEmptyCorpusArray,
  assertOptionalKeyWitnessedBothWays,
  checkSchema,
  EXPORT_FINGERPRINT,
  missingPostUpdateKeys,
  POST_UPDATE_SAVE_KEYS,
  SCHEMA_LEVELS,
  type SchemaFingerprint,
  type SchemaLevel,
} from '../src/save-schema.js';
import { requireFixture } from './helpers/require-fixture.js';

const DOMAIN_ROOT = join(__dirname, '..');
const SHEET_MATH_DIR = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math');

/**
 * The fixture directory also carries `payload-*.json` (an API-assembled `AccountPayload`, a
 * different root shape entirely) and `README.md` — neither is a subject of `EXPORT_FINGERPRINT`
 * (`root: 'save'`). The distinction is made on CONTENT, not on filename prefix: `EXPORT_LEVEL`'s
 * top-level `keys` require `export_version` and `generated_at`, which a save export always carries
 * and an API-assembled payload genuinely does not (`sheet-math/README.md`'s own "May not prove"
 * row for `payload-20260812-8heroes.json` says so). Verified directly: parsing every committed
 * sheet-math/ JSON file and checking for both keys puts `payload-20260812-8heroes.json` on one
 * side and all six `save-*.json` captures on the other — the same file this discriminator would
 * produce from a naming convention, but derived from the artifact's own declared shape instead of
 * a guess about what future filenames will look like. This is the same style of positive,
 * content-based discriminator `fixture-corpus.test.ts` already uses for `skills.refunds` /
 * `vagas_campo` / `bag_tabs_bonus`.
 */
function isSaveExportCapture(parsed: unknown): parsed is Record<string, unknown> {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    'export_version' in parsed &&
    'generated_at' in parsed
  );
}

interface CorpusMember {
  readonly file: string;
  readonly body: Record<string, unknown>;
}

/** Every committed sheet-math/ fixture that is a save export, discovered by walking the directory. */
function discoverCorpus(): CorpusMember[] {
  const jsonFiles = readdirSync(SHEET_MATH_DIR).filter((f) => f.endsWith('.json'));
  const corpus: CorpusMember[] = [];
  for (const file of jsonFiles) {
    const parsed: unknown = JSON.parse(readFileSync(join(SHEET_MATH_DIR, file), 'utf8'));
    if (isSaveExportCapture(parsed)) corpus.push({ file, body: parsed });
  }
  return corpus;
}

function loadCorpus(): CorpusMember[] | null {
  if (!requireFixture(SHEET_MATH_DIR, 'export-fingerprint corpus sweep')) return null;
  return discoverCorpus();
}

/**
 * Every save-export capture committed as of this change. Asserted as a SUBSET of what discovery
 * finds (not equality) — a rename or deletion shrinking the sweep must fail here, but a new
 * capture landing later must NOT require editing this list, or the dynamic-discovery property
 * above is worthless. See `sheet-math/README.md` for what each capture is.
 *
 * RE-POINTED when the five 2026-08-16/17 captures were retired. They were the only entries here
 * that no math suite could still read, and the list had never picked up the four captures that
 * replaced them — so the sweep had been shrinking toward one file while reading as if it covered
 * the corpus. It now names the current ones, which makes the subset assertion bite on what the
 * repo actually ships rather than on what it shipped in August.
 */
const EXPECTED_CORPUS_FILES = [
  'save-20260813-5heroes.json',
  'save-20260818-12heroes.json',
  'save-20260819-respec-crit-cdr.json',
  'save-20260822-15heroes-tree-crit-dmg.json',
  'save-20260823-13heroes-crit-points.json',
] as const;

/**
 * RED-state mutation tests exercise `checkSchema`'s discriminating behaviour — missing/added key
 * detection — which is a property of the engine in `save-schema.ts`, not of any one fixture's
 * content. Every corpus member is checked for equality against the SAME declared key set, so the
 * GREEN sweep below already proves, per file, that each one individually carries
 * `skills.totals.vagas_campo` (etc.) — a mutation test repeated per file would only re-demonstrate
 * that fact N times, not exercise a code path the GREEN sweep leaves untouched. One representative
 * real capture is kept for the RED states: the historical corpus file this suite was originally
 * authored against, still a live corpus member today. 3 mutations x 6 files would be 18 assertions
 * for zero additional failure modes caught — noise, not coverage.
 */
const RED_STATE_REPRESENTATIVE_PATH = join(SHEET_MATH_DIR, 'save-20260813-5heroes.json');

function loadRedStateRepresentative(): Record<string, unknown> | null {
  if (!requireFixture(RED_STATE_REPRESENTATIVE_PATH, 'export-fingerprint RED-state representative')) {
    return null;
  }
  return JSON.parse(readFileSync(RED_STATE_REPRESENTATIVE_PATH, 'utf8')) as Record<string, unknown>;
}

/** Deep-clones a corpus member so every mutation test starts from an untouched copy. */
function cloneCorpus(corpus: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(corpus)) as Record<string, unknown>;
}

describe('EXPORT_FINGERPRINT — corpus check (MSG-08, MSG-18)', () => {
  const corpus = loadCorpus();
  const representative = loadRedStateRepresentative();

  it('MSG-30: sourceArtifact names the committed artifact and its capture', () => {
    // Provenance, not the corpus this fingerprint is CHECKED against — deliberately left pointing
    // at the 2026-08-13 capture even though the sweep below now runs over every save export.
    // MSG-30 records where the key set was AUTHORED FROM, which does not change just because more
    // captures are now checked against it.
    expect(EXPORT_FINGERPRINT.root).toBe('save');
    expect(EXPORT_FINGERPRINT.sourceArtifact).toContain('save-20260813-5heroes.json');
    expect(EXPORT_FINGERPRINT.sourceArtifact).toContain('2026-08-13');
    expect(EXPORT_FINGERPRINT.gameBuild.length).toBeGreaterThan(0);
    expect(EXPORT_FINGERPRINT.capturedAt.length).toBeGreaterThan(0);
  });

  it('non-vacuity: the sweep discovers more than one save-export capture under sheet-math/', () => {
    if (!corpus) return;
    expect(corpus.length, `walked ${SHEET_MATH_DIR}, found ${corpus.length} save-export captures`).toBeGreaterThan(1);
  });

  it('non-vacuity: every expected capture is among those discovered (a rename cannot quietly shrink the sweep)', () => {
    if (!corpus) return;
    const discoveredFiles = corpus.map((c) => c.file);
    for (const expected of EXPECTED_CORPUS_FILES) {
      expect(discoveredFiles, `expected save-export capture missing from discovery: ${expected}`).toContain(expected);
    }
  });

  it('the content-based discriminator excludes the non-export payload fixture', () => {
    if (!corpus) return;
    const discoveredFiles = corpus.map((c) => c.file);
    expect(discoveredFiles).not.toContain('payload-20260812-8heroes.json');
  });

  it('every discovered save-export capture is ok:true — equality modulo allowance, never a subset (MSG-08)', () => {
    if (!corpus) return;
    for (const { file, body } of corpus) {
      expect(checkSchema(body, EXPORT_FINGERPRINT), `capture: ${file}`).toEqual({ ok: true });
    }
  });

  it('non-vacuity: save.heroes and save.items are non-empty in the representative capture (MSG-06)', () => {
    if (!representative) return;
    assertNonEmptyCorpusArray(representative.heroes as unknown[], 'save.heroes');
    assertNonEmptyCorpusArray(representative.items as unknown[], 'save.items');
  });

  it('non-vacuity: item.slot is present on at least one export item and absent on at least one (AD-087)', () => {
    if (!representative) return;
    assertOptionalKeyWitnessedBothWays(
      representative.items as Record<string, unknown>[],
      'slot',
      'save.items[].slot',
    );
  });

  describe('three named red states — one mutation of the representative export each', () => {
    it('RED 1: removing skills.totals.vagas_campo reports it missing, path-qualified', () => {
      if (!representative) return;
      const mutated = cloneCorpus(representative);
      const totals = (mutated.skills as Record<string, unknown>).totals as Record<string, unknown>;
      delete totals.vagas_campo;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: ['save.skills.totals.vagas_campo'],
        addedKeys: [],
      });
    });

    it('RED 2: adding skills.totals.something_new reports it added, path-qualified', () => {
      if (!representative) return;
      const mutated = cloneCorpus(representative);
      const totals = (mutated.skills as Record<string, unknown>).totals as Record<string, unknown>;
      totals.something_new = 1;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['save.skills.totals.something_new'],
      });
    });

    it('RED 3: adding a TOP-LEVEL something_new reports it added, demonstrated separately from the nested case', () => {
      if (!representative) return;
      const mutated = cloneCorpus(representative);
      mutated.something_new = 1;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['save.something_new'],
      });
    });
  });

  it('MSG-09/MSG-10: fails loudly under CI=1 when the corpus directory is renamed away', () => {
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/does-not-exist-sheet-math');
    vi.stubEnv('CI', '1');
    try {
      expect(() => requireFixture(missingPath, 'export-fingerprint corpus check')).toThrow(
        /is missing in CI/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requireFixture returns false and does not throw outside CI when the artifact is absent', () => {
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/does-not-exist-sheet-math');
    vi.stubEnv('CI', '');
    try {
      expect(requireFixture(missingPath, 'export-fingerprint corpus check')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('POST_UPDATE_SAVE_KEYS — the one catalogue (MSG-17)', () => {
  /** Walks a SchemaFingerprint's declared levels to confirm `path` lands on a declared KEY —
   * never a hand-typed guess. A second, hand-copied list of the same paths could not pass this. */
  function resolvesToDeclaredKey(fingerprint: SchemaFingerprint, path: string): boolean {
    const segments = path.split('.');
    let level: SchemaLevel = fingerprint.level;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i] as string;
      const isLast = i === segments.length - 1;
      if (!level.keys.includes(segment)) return false;
      if (isLast) return true;

      const child = level.children?.[segment];
      if (!child || child.kind !== 'object') return false;
      level = child.level;
    }
    return false;
  }

  it('every POST_UPDATE_SAVE_KEYS entry resolves to a declared key at its declared level in EXPORT_FINGERPRINT', () => {
    for (const path of POST_UPDATE_SAVE_KEYS) {
      expect(resolvesToDeclaredKey(EXPORT_FINGERPRINT, path), `"${path}" must resolve`).toBe(true);
    }
  });

  it('a path that is NOT declared fails the resolver — proving the resolver itself discriminates', () => {
    expect(resolvesToDeclaredKey(EXPORT_FINGERPRINT, 'skills.totals.not_a_real_key')).toBe(false);
    expect(resolvesToDeclaredKey(EXPORT_FINGERPRINT, 'skills.not_a_real_key')).toBe(false);
  });

  it('POST_UPDATE_SAVE_KEYS composes only shared SCHEMA_LEVELS keys — one catalogue, not two', () => {
    expect(SCHEMA_LEVELS.skills.keys).toContain('refunds');
    expect(SCHEMA_LEVELS.skillsTotals.keys).toContain('vagas_campo');
    expect(SCHEMA_LEVELS.skillsTotals.keys).toContain('bag_tabs_bonus');
  });
});

describe('missingPostUpdateKeys — the positive discriminator (MSG-11)', () => {
  const corpus = loadCorpus();

  it('is positive only: value 0/false/null/[] all count as present, never treated as missing', () => {
    const body = {
      skills: {
        refunds: {},
        totals: { vagas_campo: 0, bag_tabs_bonus: false },
      },
    };
    expect(missingPostUpdateKeys(body)).toEqual([]);
  });

  it('names every absent key, path-qualified, when all three are missing', () => {
    expect(missingPostUpdateKeys({})).toEqual([
      'skills.refunds',
      'skills.totals.vagas_campo',
      'skills.totals.bag_tabs_bonus',
    ]);
  });

  it('names only the specific absent keys — a partially-complete body reports the gap precisely', () => {
    const body = { skills: { refunds: {}, totals: { vagas_campo: 1 } } };
    expect(missingPostUpdateKeys(body)).toEqual(['skills.totals.bag_tabs_bonus']);
  });

  it('accepts every real committed save-export capture (empty result — every new key present)', () => {
    if (!corpus) return;
    for (const { file, body } of corpus) {
      expect(missingPostUpdateKeys(body), `capture: ${file}`).toEqual([]);
    }
  });
});
