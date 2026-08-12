/**
 * MP2 F4 — the gate entry point and the provenance ladder (design §4.4, §1.2, `AD-026`).
 *
 * `runFidelityGate` is the one function that runs the whole gate, so the ordering (guard →
 * parse → compare → executed-work floor) cannot be reassembled wrongly per-test (design TD-1).
 */
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import type { AccountPayload } from '@bombfarm/contracts';
import type { FidelityPair, LiveSource } from './fidelity-pair';
import { frameLiveCapture } from './fidelity-pair';
import { assertCaptureFullFidelity } from './fidelity-grade';
import { compareAccountResults, type CompareOptions } from './fidelity-compare';
import { FidelityGateError } from './fidelity-gate-error';

export interface FidelityGateResult {
  readonly source: LiveSource;
  readonly heroesCompared: number;
  readonly statComparisons: number;
  readonly accountFieldsCompared: number;
  readonly itemsCompared: number;
}

export type RunFidelityGateOptions = CompareOptions;

/** One assertion registered against a `LiveSource` token in the provenance ladder. */
export interface GateAssertion {
  readonly description: string;
  readonly run: (pair: FidelityPair) => void;
}

/**
 * Strictness ladder (design §1.2, `AD-026`): both branches are non-empty and exercised now —
 * `export-derived` for real (the committed pair), `memory-assembled` against a synthetic
 * manifest in T5's own test — so flipping the token can neither silently drop the pre-F2
 * checks nor land on an untested post-F2 stub.
 */
export const PROVENANCE_LADDER: Record<LiveSource, readonly GateAssertion[]> = {
  'export-derived': [
    {
      description: 'the live capture is byte-reproducible by re-running frameLiveCapture on the export (a regression fence, not a discovery instrument — design §1.1)',
      run: (pair) => {
        const regenerated = frameLiveCapture(pair.exportPayload as unknown as Record<string, unknown>, {
          capturedAt: pair.manifest.live.capturedAt,
        });
        const liveText = JSON.stringify(pair.livePayload);
        const regeneratedText = JSON.stringify(regenerated);
        if (liveText !== regeneratedText) {
          throw new FidelityGateError(
            'manifestInvalid',
            'live.source is "export-derived" but live-capture.json is not byte-reproducible from export-capture.json via frameLiveCapture — it may have drifted or been hand-edited.',
            { source: 'export-derived' },
          );
        }
      },
    },
  ],
  'memory-assembled': [
    {
      description: 'the live capture must NOT be byte-equal to the framed export — proof it actually came from somewhere else',
      run: (pair) => {
        const framedFromExport = frameLiveCapture(pair.exportPayload as unknown as Record<string, unknown>, {
          capturedAt: pair.manifest.live.capturedAt,
        });
        const liveText = JSON.stringify(pair.livePayload);
        const framedText = JSON.stringify(framedFromExport);
        if (liveText === framedText) {
          throw new FidelityGateError(
            'manifestInvalid',
            'live.source is "memory-assembled" but live-capture.json is byte-identical to the framed export — this looks like the export-derived file was re-committed by mistake.',
            { source: 'memory-assembled' },
          );
        }
      },
    },
    {
      description: 'live.readerVersion and a non-empty live.fingerprints are required at memory-assembled',
      run: (pair) => {
        if (!pair.manifest.live.readerVersion || !pair.manifest.live.fingerprints || Object.keys(pair.manifest.live.fingerprints).length === 0) {
          throw new FidelityGateError(
            'manifestInvalid',
            'live.source is "memory-assembled" but live.readerVersion or a non-empty live.fingerprints is missing from pair.json.',
            { source: 'memory-assembled' },
          );
        }
      },
    },
  ],
};

/** Runs every registered assertion for `pair.manifest.live.source`. An unknown token throws. */
export function assertProvenanceLadder(pair: FidelityPair): void {
  const assertions = PROVENANCE_LADDER[pair.manifest.live.source];
  if (!assertions || assertions.length === 0) {
    throw new FidelityGateError(
      'manifestInvalid',
      `No provenance-ladder assertions registered for live.source "${pair.manifest.live.source}".`,
      { source: pair.manifest.live.source },
    );
  }
  for (const assertion of assertions) {
    assertion.run(pair);
  }
}

/**
 * The export side has no fidelity block on the file-adapter path (`ACS-05.5`) — that is normal,
 * not degraded, so absence is not asserted here. If a fidelity block IS present (a future,
 * fidelity-aware export), it is still held to the full guard.
 */
function assertExportCaptureIsUsable(payload: AccountPayload, label: string): void {
  if (payload.fidelity === undefined) return;
  assertCaptureFullFidelity(payload, label);
}

/**
 * Runs the whole gate: live-capture fidelity guard → export-capture light guard → parse both
 * sides through F1's entry point → cross-source compare → assert the manifest's executed-work
 * floors. Every step throws `FidelityGateError` on failure — there is no partial success return
 * (design §4.4's body; the provenance ladder above is a separate, independently-tested table —
 * see `assertProvenanceLadder` and `fidelity-gate.test.ts`).
 */
export function runFidelityGate(pair: FidelityPair, opts: RunFidelityGateOptions = {}): FidelityGateResult {
  assertCaptureFullFidelity(pair.livePayload, 'live');
  assertExportCaptureIsUsable(pair.exportPayload, 'export');

  const liveResult = parseAccountPayload(pair.livePayload, []);
  const exportResult = parseAccountPayload(pair.exportPayload, []);

  const counts = compareAccountResults(liveResult, exportResult, opts);

  const { expected } = pair.manifest;
  if (counts.heroesCompared < expected.heroes) {
    throw new FidelityGateError(
      'underComparison',
      `Only ${counts.heroesCompared} hero(es) were compared, but pair.json declares expected.heroes=${expected.heroes}.`,
      { field: 'heroes', actual: counts.heroesCompared, expected: expected.heroes },
    );
  }
  if (counts.itemsCompared < expected.items) {
    throw new FidelityGateError(
      'underComparison',
      `Only ${counts.itemsCompared} item(s) were compared, but pair.json declares expected.items=${expected.items}.`,
      { field: 'items', actual: counts.itemsCompared, expected: expected.items },
    );
  }
  if (counts.statComparisons < expected.statComparisons) {
    throw new FidelityGateError(
      'underComparison',
      `Only ${counts.statComparisons} stat comparison(s) ran, but pair.json declares expected.statComparisons=${expected.statComparisons}.`,
      { field: 'statComparisons', actual: counts.statComparisons, expected: expected.statComparisons },
    );
  }

  return {
    source: pair.manifest.live.source,
    heroesCompared: counts.heroesCompared,
    statComparisons: counts.statComparisons,
    accountFieldsCompared: counts.accountFieldsCompared,
    itemsCompared: counts.itemsCompared,
  };
}
