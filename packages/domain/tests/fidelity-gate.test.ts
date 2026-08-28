import type { AccountFidelity, AccountPayload } from '@bombfarm/contracts';
import * as importSave from '@bombfarm/domain/import-save';
import { describe, expect, it, vi } from 'vitest';
import { PROVENANCE_LADDER, assertProvenanceLadder, runFidelityGate } from './helpers/fidelity-gate';
import { frameLiveCapture, loadFidelityPair, type FidelityPair, type FidelityPairManifest, type LiveSource } from './helpers/fidelity-pair';
import { FidelityGateError } from './helpers/fidelity-gate-error';

const STAMP = { capturedAt: '2026-08-12T00:00:00.000Z' };

function expectFidelityError(fn: () => unknown, code: string): FidelityGateError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FidelityGateError);
    expect((err as FidelityGateError).code).toBe(code);
    return err as FidelityGateError;
  }
  throw new Error(`expected fn to throw FidelityGateError(${code}), but it did not throw`);
}

function fullFidelity(): AccountFidelity {
  const section = { status: 'resolved' as const, capturedAt: STAMP.capturedAt };
  return { account: section, heroes: section, skills: section, casa: section, items: section };
}

function baseManifest(overrides: Partial<FidelityPairManifest> = {}): FidelityPairManifest {
  return {
    schemaVersion: 1,
    accountLabel: 'synthetic test account',
    export: {
      file: 'export-capture.json',
      gameBuild: '2026.01.01',
      capturedAt: STAMP.capturedAt,
      scrubbed: ['account_id', 'player_name'],
    },
    live: {
      file: 'live-capture.json',
      source: 'export-derived',
      gameBuild: '2026.01.01',
      capturedAt: STAMP.capturedAt,
      scrubbed: ['account_id', 'player_name'],
    },
    expected: { heroes: 0, items: 0, statComparisons: 0 },
    ...overrides,
  };
}

describe(`cross-source equality [live.source=export-derived — F2 has not landed; this half is a regression fence]`, () => {
  it('the committed pair agrees on every hero across all three sheet blocks — returned counts equal pair.json expected exactly', () => {
    const pair = loadFidelityPair();
    const result = runFidelityGate(pair);
    expect(result.source).toBe('export-derived');
    expect(result.heroesCompared).toBe(pair.manifest.expected.heroes);
    expect(result.itemsCompared).toBe(pair.manifest.expected.items);
    expect(result.statComparisons).toBe(pair.manifest.expected.statComparisons);
  });
});

describe('runFidelityGate — executed-work floor (device 2, edge against a vacuous loop)', () => {
  it('throws underComparison when a hand-built pair with an empty roster claims fewer heroes than the manifest declares', () => {
    const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
    const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
    const pair: FidelityPair = {
      manifest: baseManifest({ expected: { heroes: 1, items: 0, statComparisons: 0 } }),
      exportPayload,
      livePayload,
    };
    const err = expectFidelityError(() => runFidelityGate(pair), 'underComparison');
    expect(err.message).toContain('heroes');
  });

  it('throws underComparison when a hand-built pair claims fewer items than the manifest declares, even with a matching roster', () => {
    const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
    const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
    const pair: FidelityPair = {
      manifest: baseManifest({ expected: { heroes: 0, items: 5, statComparisons: 0 } }),
      exportPayload,
      livePayload,
    };
    const err = expectFidelityError(() => runFidelityGate(pair), 'underComparison');
    expect(err.message).toContain('items');
  });

  it('a hand-built pair whose declared floors are met (all zero, empty roster) passes', () => {
    const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
    const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
    const pair: FidelityPair = { manifest: baseManifest(), exportPayload, livePayload };
    const result = runFidelityGate(pair);
    expect(result.heroesCompared).toBe(0);
    expect(result.itemsCompared).toBe(0);
    expect(result.statComparisons).toBe(0);
  });
});

describe('runFidelityGate — degraded input short-circuits before any parsing', () => {
  it('a degraded live capture throws notFullFidelity; onHeroCompared and parseAccountPayload are never invoked', () => {
    const parseSpy = vi.spyOn(importSave, 'parseAccountPayload');
    const onHeroCompared = vi.fn();
    const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
    const degradedFidelity: AccountFidelity = { ...fullFidelity(), skills: { status: 'missing' } };
    const livePayload: AccountPayload = { ...exportPayload, fidelity: degradedFidelity };
    const pair: FidelityPair = { manifest: baseManifest(), exportPayload, livePayload };

    expectFidelityError(() => runFidelityGate(pair, { onHeroCompared }), 'notFullFidelity');
    expect(onHeroCompared).not.toHaveBeenCalled();
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });

  it('an export capture that DOES carry a degraded fidelity block still fails the gate (guard-lite still validates when present)', () => {
    const exportPayload: AccountPayload = {
      account: { phase: 1 },
      heroes: [],
      skills: {},
      casa: {},
      items: [],
      fidelity: { ...fullFidelity(), items: { status: 'missing' } },
    };
    // frameLiveCapture always synthesises its own full-resolved block, so the live side stays
    // full fidelity here — this isolates the assertion to the export-side guard-lite path.
    const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
    const pair: FidelityPair = { manifest: baseManifest(), exportPayload, livePayload };
    const err = expectFidelityError(() => runFidelityGate(pair), 'notFullFidelity');
    expect(err.message).toContain('items: missing');
  });
});

describe('provenance ladder (design §1.2) — cannot be neutered', () => {
  it('has exactly three keys, each registering a non-empty assertion list', () => {
    expect(Object.keys(PROVENANCE_LADDER).sort()).toEqual(['api-assembled', 'export-derived', 'memory-assembled']);
    expect(PROVENANCE_LADDER['export-derived'].length).toBeGreaterThan(0);
    expect(PROVENANCE_LADDER['memory-assembled'].length).toBeGreaterThan(0);
    expect(PROVENANCE_LADDER['api-assembled'].length).toBeGreaterThan(0);
  });

  it('keeps memory-assembled distinct from api-assembled — a rename would rewrite a merged tripwire', () => {
    // Shipped as an API source, but telemetry is still memory-sourced. Collapsing the two
    // tokens (or renaming one into the other) would silently retarget assertions that already
    // shipped against a different claim.
    expect(PROVENANCE_LADDER['memory-assembled']).not.toBe(PROVENANCE_LADDER['api-assembled']);
  });

  it('an unknown live.source token throws manifestInvalid', () => {
    const exportPayload: AccountPayload = { account: {}, heroes: [], skills: {}, casa: {}, items: [] };
    const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
    const manifest = baseManifest({ live: { ...baseManifest().live, source: 'made-up' as LiveSource } });
    const pair: FidelityPair = { manifest, exportPayload, livePayload };
    expectFidelityError(() => assertProvenanceLadder(pair), 'manifestInvalid');
  });

  describe('[live.source=export-derived — F2 has not landed; this half is a regression fence]', () => {
    it('the committed pair passes: live-capture.json is byte-reproducible from export-capture.json', () => {
      const pair = loadFidelityPair();
      expect(() => assertProvenanceLadder(pair)).not.toThrow();
    });

    it('fails when the live capture has drifted from a fresh frameLiveCapture regeneration', () => {
      const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
      const livePayload = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
      const doctoredLive: AccountPayload = { ...livePayload, account: { phase: 999 } };
      const pair: FidelityPair = { manifest: baseManifest(), exportPayload, livePayload: doctoredLive };
      expectFidelityError(() => assertProvenanceLadder(pair), 'manifestInvalid');
    });
  });

  // Both independent-origin tokens get the identical battery, so neither can rot into an
  // untested stub while the other carries the suite.
  describe.each(['memory-assembled', 'api-assembled'] as const)(
    '[live.source=%s] — exercised now against a synthetic manifest, before the real pair ever carries the token',
    (token) => {
    function memoryAssembledManifest(): FidelityPairManifest {
      return baseManifest({
        live: {
          file: 'live-capture.json',
          source: token,
          gameBuild: '2026.01.01',
          capturedAt: STAMP.capturedAt,
          scrubbed: ['account_id', 'player_name'],
          readerVersion: '1.0.0-test',
          fingerprints: { account: 'abc123' },
        },
      });
    }

    it('passes when the live capture differs from the framed export and carries readerVersion + non-empty fingerprints', () => {
      const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
      const framed = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
      // A capture that is NOT byte-identical to the export-derived framing — simulating a real
      // independent-origin payload without needing a real second capture to exist yet.
      const livePayload: AccountPayload = { ...framed, account: { phase: 1, extraReaderField: true } };
      const pair: FidelityPair = { manifest: memoryAssembledManifest(), exportPayload, livePayload };
      expect(() => assertProvenanceLadder(pair)).not.toThrow();
    });

    it('fails when the live capture is byte-identical to the framed export (the export-derived file was re-committed by mistake)', () => {
      const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
      const framed = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
      const pair: FidelityPair = { manifest: memoryAssembledManifest(), exportPayload, livePayload: framed };
      const err = expectFidelityError(() => assertProvenanceLadder(pair), 'manifestInvalid');
      expect(err.message).toContain(token);
    });

    it('fails when readerVersion or fingerprints is missing from the manifest', () => {
      const exportPayload: AccountPayload = { account: { phase: 1 }, heroes: [], skills: {}, casa: {}, items: [] };
      const framed = frameLiveCapture(exportPayload as unknown as Record<string, unknown>, STAMP);
      const livePayload: AccountPayload = { ...framed, account: { phase: 1, extraReaderField: true } };
      const manifestNoReaderVersion = memoryAssembledManifest();
      const manifest: FidelityPairManifest = {
        ...manifestNoReaderVersion,
        live: { ...manifestNoReaderVersion.live, readerVersion: undefined, fingerprints: undefined },
      };
      const pair: FidelityPair = { manifest, exportPayload, livePayload };
      expectFidelityError(() => assertProvenanceLadder(pair), 'manifestInvalid');
    });
  },
  );
});
