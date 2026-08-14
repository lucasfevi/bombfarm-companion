/**
 * MP5 F4 (T7) — the positive acceptance gate in `parseSaveFile`, `MSG-11`…`MSG-13`, `MSG-15`.
 *
 * MSG-12's core claim lives here: a discriminator keyed off the ABSENCE of the old keys would
 * accept a truncated/hand-edited file (which also lacks them). This suite proves the real
 * discriminator is positive — keyed off PRESENCE of the new keys — by asserting the truncated
 * and the complete post-patch row in the SAME test, so the distinction is visible in one place.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseSaveFile } from '../src/import-save.js';
import { requireFixture } from './helpers/require-fixture.js';

const DOMAIN_ROOT = join(__dirname, '..');
const REJECTION_DIR = join(DOMAIN_ROOT, 'tests/fixtures/rejection');
const CORPUS_PATH = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math/save-20260813-5heroes.json');

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadRejectionFixture(name: 'pre-update-save.json' | 'truncated-save.json'): unknown | null {
  const path = join(REJECTION_DIR, name);
  if (!requireFixture(path, `save-acceptance rejection fixture: ${name}`)) return null;
  return loadJson(path);
}

function loadCorpus(): Record<string, unknown> | null {
  if (!requireFixture(CORPUS_PATH, 'save-acceptance complete-post-patch corpus')) return null;
  return loadJson(CORPUS_PATH) as Record<string, unknown>;
}

describe('parseSaveFile — the positive acceptance gate (MSG-11, MSG-12, MSG-13)', () => {
  const preUpdate = loadRejectionFixture('pre-update-save.json');
  const truncated = loadRejectionFixture('truncated-save.json');
  const corpus = loadCorpus();

  it('MSG-12: truncated AND complete post-patch rows, in the SAME test — proves the discriminator is positive, not "lacks the old keys"', () => {
    if (!truncated || !corpus) return;

    const truncatedResult = parseSaveFile(truncated, []);
    const completeResult = parseSaveFile(corpus, []);

    // A NEGATIVE discriminator ("lacks the retired fields ⇒ accept") would accept the truncated
    // file too — it also lacks every old key. The real gate rejects it because it ALSO lacks the
    // new keys.
    expect(truncatedResult.rejected).toEqual({ reason: 'unsupportedSaveShape', heroNames: [] });
    expect(completeResult.rejected).toBeNull();

    // The two outcomes must differ — this is the assertion that proves the discriminator
    // actually discriminates between "genuinely old/broken" and "genuinely current".
    expect(truncatedResult.rejected).not.toEqual(completeResult.rejected);
  });

  it('MSG-13: a pre-patch export (old keys present, new keys absent) is rejected — no hero, item or account value reaches the caller', () => {
    if (!preUpdate) return;
    const result = parseSaveFile(preUpdate, []);

    expect(result.rejected).toEqual({ reason: 'unsupportedSaveShape', heroNames: [] });
    expect(result.candidates).toEqual([]);
    expect(result.inventory).toEqual([]);
    expect(result.account).toEqual({ tree: null, houseIdx: null, houseLevel: null, phase: null });
  });

  it('a truncated file (neither old nor new keys) is rejected the same way as a pre-patch file', () => {
    if (!truncated) return;
    const result = parseSaveFile(truncated, []);
    expect(result.rejected).toEqual({ reason: 'unsupportedSaveShape', heroNames: [] });
    expect(result.candidates).toEqual([]);
    expect(result.inventory).toEqual([]);
  });

  it('valid-JSON-but-not-a-save is still notASaveFile, unchanged (the gate does not widen this existing branch)', () => {
    const result = parseSaveFile({ not_a_save: true }, []);
    expect(result.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
  });

  it('MSG-15: the rejection names the absent path-qualified keys in warnings (data, not rendered copy — AD-040)', () => {
    if (!preUpdate) return;
    const { warnings } = parseSaveFile(preUpdate, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('skills.refunds');
    expect(warnings[0]).toContain('skills.totals.vagas_campo');
    expect(warnings[0]).toContain('skills.totals.bag_tabs_bonus');
  });

  it('presence-not-value: new keys present with 0 / [] / null are ACCEPTED — absent is never confused with zero-valued', () => {
    const payload = {
      heroes: [
        {
          id: '1',
          name: 'Zeroed',
          birth_stats: {
            dmg: 1,
            energia: 1,
            speed: 1,
            penetration: 0,
            crit_chance: 0,
            cooldown_reduction: 0,
            crit_dmg: 1,
            luck: 0,
          },
        },
      ],
      skills: {
        refunds: null,
        totals: { vagas_campo: 0, bag_tabs_bonus: 0 },
      },
    };
    const result = parseSaveFile(payload, []);
    expect(result.rejected).toBeNull();
  });

  it('requireFixture: fails loudly under CI=1 when the rejection fixture directory is renamed away', () => {
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/rejection/does-not-exist.json');
    vi.stubEnv('CI', '1');
    try {
      expect(() => requireFixture(missingPath, 'save-acceptance rejection fixture')).toThrow(/is missing in CI/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requireFixture: returns false, does not throw, outside CI when the rejection fixture is absent', () => {
    const missingPath = join(DOMAIN_ROOT, 'tests/fixtures/rejection/does-not-exist.json');
    vi.stubEnv('CI', '');
    try {
      expect(requireFixture(missingPath, 'save-acceptance rejection fixture')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('both rejection fixtures declare their _meta.purpose as a synthetic rejection fixture, never a game observation', () => {
    if (!preUpdate || !truncated) return;
    for (const fixture of [preUpdate, truncated] as Record<string, unknown>[]) {
      const meta = fixture._meta as Record<string, unknown>;
      expect(typeof meta.purpose).toBe('string');
      expect((meta.purpose as string).toLowerCase()).toContain('synthetic');
      expect((meta.purpose as string).toLowerCase()).toContain('never a game observation');
    }
  });
});
