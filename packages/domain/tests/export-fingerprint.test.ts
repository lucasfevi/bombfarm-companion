/**
 * MP5 F4 (T4) — the export corpus check and its three named red states.
 *
 * The spec's sharpest finding (spec.md Problem Statement) is that the PREVIOUS route fingerprint
 * was authored from an already-drifted capture and its only cross-check was a subset assertion —
 * unfalsifiable on either an addition or a removal. This suite runs the opposite check: equality
 * modulo the fingerprint's own named allowance, over the real committed export corpus, with the
 * key sets written down as literals in save-schema.ts (never derived from the artifact here).
 */
import { readFileSync } from 'node:fs';
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
const CORPUS_PATH = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math/save-20260813-5heroes.json');

function loadCorpus(): Record<string, unknown> | null {
  if (!requireFixture(CORPUS_PATH, 'export-fingerprint corpus check')) return null;
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Record<string, unknown>;
}

/** Deep-clones the corpus so every mutation test starts from an untouched copy. */
function cloneCorpus(corpus: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(corpus)) as Record<string, unknown>;
}

describe('EXPORT_FINGERPRINT — corpus check (MSG-08, MSG-18)', () => {
  const corpus = loadCorpus();

  it('MSG-30: sourceArtifact names the committed artifact and its capture', () => {
    expect(EXPORT_FINGERPRINT.root).toBe('save');
    expect(EXPORT_FINGERPRINT.sourceArtifact).toContain('save-20260813-5heroes.json');
    expect(EXPORT_FINGERPRINT.sourceArtifact).toContain('2026-08-13');
    expect(EXPORT_FINGERPRINT.gameBuild.length).toBeGreaterThan(0);
    expect(EXPORT_FINGERPRINT.capturedAt.length).toBeGreaterThan(0);
  });

  it('the unmutated committed export is ok:true — equality modulo allowance, never a subset (MSG-08)', () => {
    if (!corpus) return;
    expect(checkSchema(corpus, EXPORT_FINGERPRINT)).toEqual({ ok: true });
  });

  it('non-vacuity: save.heroes and save.items are non-empty in the committed corpus (MSG-06)', () => {
    if (!corpus) return;
    assertNonEmptyCorpusArray(corpus.heroes as unknown[], 'save.heroes');
    assertNonEmptyCorpusArray(corpus.items as unknown[], 'save.items');
  });

  it('non-vacuity: item.slot is present on at least one export item and absent on at least one (AD-087)', () => {
    if (!corpus) return;
    assertOptionalKeyWitnessedBothWays(
      corpus.items as Record<string, unknown>[],
      'slot',
      'save.items[].slot',
    );
  });

  describe('three named red states — one mutation of the committed export each', () => {
    it('RED 1: removing skills.totals.vagas_campo reports it missing, path-qualified', () => {
      if (!corpus) return;
      const mutated = cloneCorpus(corpus);
      const totals = (mutated.skills as Record<string, unknown>).totals as Record<string, unknown>;
      delete totals.vagas_campo;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: ['save.skills.totals.vagas_campo'],
        addedKeys: [],
      });
    });

    it('RED 2: adding skills.totals.something_new reports it added, path-qualified', () => {
      if (!corpus) return;
      const mutated = cloneCorpus(corpus);
      const totals = (mutated.skills as Record<string, unknown>).totals as Record<string, unknown>;
      totals.something_new = 1;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['save.skills.totals.something_new'],
      });
    });

    it('RED 3: adding a TOP-LEVEL something_new reports it added, demonstrated separately from the nested case', () => {
      if (!corpus) return;
      const mutated = cloneCorpus(corpus);
      mutated.something_new = 1;
      expect(checkSchema(mutated, EXPORT_FINGERPRINT)).toEqual({
        ok: false,
        missingKeys: [],
        addedKeys: ['save.something_new'],
      });
    });
  });

  it('MSG-09/MSG-10: fails loudly under CI=1 when the corpus artifact is renamed away', () => {
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math/does-not-exist.json');
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
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math/does-not-exist.json');
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

  it('accepts the real committed export corpus (empty result — every new key present)', () => {
    if (!corpus) return;
    expect(missingPostUpdateKeys(corpus)).toEqual([]);
  });
});
