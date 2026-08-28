/**
 * What survives of MP5 F2's characterization baseline: the RECORDER, and the properties of the
 * recorder itself.
 *
 * `recordInvarianceSurface` walks the whole surviving numeric surface of the corpus and encodes
 * every leaf with `encodeNumber`, a sign- and precision-preserving encoding chosen so a
 * comparison can be exact rather than tolerant — a decimal-digit tolerance would silently absorb
 * exactly the class of drift this was built to catch (a 5e-3 error still rounds "close"), and a
 * deep-equality comparison would treat `0` and `-0` as equal, which is the one corner (MKR-18) it
 * must not paper over. What remains asserted here is that the encoding round-trips exactly, that
 * the record's shape is complete for every hero, and that the recorded scalar count clears a
 * committed floor so a partially-empty recorder fails rather than passes.
 *
 * THE COMMITTED BASELINE IS DELETED (issue #206). `fixtures/invariance/baseline.json` was a
 * pre-deletion recording of ~2791 scalars, compared bit-exactly to prove that ONE deletion — F2's
 * retired damage arms, which this file is deliberately not allowed to name (see the note below) —
 * changed no surviving value. That deletion shipped, and the model has moved
 * repeatedly since — the baseline was re-recorded seven times chasing it — so the file could no
 * longer match, and re-recording it against today's output would have proved nothing about the
 * deletion it was recorded for. The seven re-recordings' footprints, which is the part worth
 * keeping, are preserved in `docs/fixture-corpus.md` §12.
 *
 * Named `invariance-*`, deliberately never named after any deleted arm (design TD-5) — a file
 * named after one would trip this feature's own absence guard (`source-surface.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import {
  CORPUS_FILES,
  decodeNumber,
  encodeNumber,
  recordInvarianceSurface,
  serializeRecord,
  type InvarianceRecord,
} from './helpers/invariance-record';

describe('invariance baseline — the pre-deletion characterization harness (MP5 F2 T2)', () => {
  it('self-test: encodeNumber round-trips exactly for every finite double, and the four special cases', () => {
    const samples = [0, -0, 1, -1, 0.1, 1e21, -1e21, 1.008, 4 / 3, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity];
    for (const v of samples) {
      const encoded = encodeNumber(v);
      const decoded = decodeNumber(encoded);
      if (Number.isNaN(v)) {
        expect(Number.isNaN(decoded), `NaN round-trip: encoded "${encoded}"`).toBe(true);
      } else {
        expect(Object.is(decoded, v), `${v} round-tripped to ${decoded} via "${encoded}"`).toBe(true);
      }
    }
  });

  it('encodeNumber distinguishes -0 from +0 — the AC-8/MKR-18 corner', () => {
    expect(encodeNumber(-0)).toBe('-0');
    expect(encodeNumber(0)).toBe('0');
    expect(encodeNumber(-0)).not.toBe(encodeNumber(0));
  });

  it('byte-reproducibility: two recordings in this session serialise identically (MKR-11)', () => {
    const first = serializeRecord(recordInvarianceSurface());
    const second = serializeRecord(recordInvarianceSurface());
    expect(second).toBe(first);
  });

  const record = recordInvarianceSurface();

  it("non-vacuity: exactly 13 heroes are recorded (5 + 8, F1's two corpus files)", () => {
    expect(record.meta.heroCount, `recorded heroes: ${Object.keys(record.heroes).join(', ')}`).toBe(13);
    expect(Object.keys(record.heroes).length).toBe(13);
  });

  it('non-vacuity: every SHEET_KEYS member is present for every hero, on every SheetKey-shaped subject', () => {
    for (const [heroKey, entry] of Object.entries(record.heroes)) {
      for (const subject of ['naked', 'applySkillTree', 'composeSheetFromBirth', 'inferSpentPoints'] as const) {
        const keys = Object.keys(entry[subject]).sort();
        expect(keys, `${heroKey}.${subject}`).toEqual([...SHEET_KEYS].sort());
      }
      expect(Object.keys(entry.sheetsFromBirth.naked).sort(), `${heroKey}.sheetsFromBirth.naked`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.sheetsFromBirth.geared).sort(), `${heroKey}.sheetsFromBirth.geared`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.peelSheetStages).sort(), `${heroKey}.peelSheetStages`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.peelSheetSources).sort(), `${heroKey}.peelSheetSources`).toEqual([...SHEET_KEYS].sort());
    }
  });

  it('non-vacuity: the recorded scalar count meets a committed floor (a zero-hero loop must fail, not pass)', () => {
    // Measured floor: 13 heroes × (8 sheet keys × ~6 sheet-shaped subjects + 9 peelSheetStages
    // fields × 8 + 4 peelSheetSources fields × 8 + combat/farm/derive/pipeline scalars +
    // breakdown ledger/formula scalars) + the 2-file scorer block. Comfortably below the
    // measured actual so a partially-empty recorder still fails this floor.
    expect(record.meta.scalarCount, `scanned corpus: ${CORPUS_FILES.join(', ')}`).toBeGreaterThanOrEqual(2500);
  });

  it('non-vacuity: both corpus files contributed a scorer record', () => {
    for (const file of CORPUS_FILES) {
      expect(record.scorer[file], `scorer record for ${file}`).toBeDefined();
      expect(Object.keys(record.scorer[file]!.perHero).length, `${file} perHero`).toBeGreaterThan(0);
    }
  });

});
