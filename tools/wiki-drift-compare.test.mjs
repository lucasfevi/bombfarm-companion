import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compareFingerprints,
  fingerprintPayload,
  readBaseline,
  serializeBaseline,
} from './wiki-drift/fingerprint.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const FIXTURES = join(root, 'wiki-drift/__fixtures__');

const apiDataCapture = JSON.parse(readFileSync(join(FIXTURES, 'api-data.captured.json'), 'utf8'));
const fasesNomesCapture = JSON.parse(
  readFileSync(join(FIXTURES, 'fases-nomes.captured.json'), 'utf8'),
);

const DATA_URL = 'https://wiki.bombfarm.net/wiki/api/data';
const FASES_NOMES_URL = 'https://wiki.bombfarm.net/wiki/api/fases-nomes';

function validBaseline() {
  return {
    schemaVersion: 1,
    capturedAt: '2026-08-14T05:17:00.000Z',
    endpoints: {
      data: fingerprintPayload(DATA_URL, apiDataCapture),
      fasesNomes: fingerprintPayload(FASES_NOMES_URL, fasesNomesCapture),
    },
  };
}

// =============================================================================================
// compareFingerprints — the six named single-mutation red states + the green direction (MWD-05,
// MWD-10..13, MWD-36)
// =============================================================================================

describe('compareFingerprints — green direction', () => {
  it('the unmodified capture against its own fingerprint yields zero diffs', () => {
    const fp = fingerprintPayload(DATA_URL, apiDataCapture);
    const observed = fingerprintPayload(DATA_URL, structuredClone(apiDataCapture));
    expect(compareFingerprints(fp, observed)).toEqual([]);
  });
});

describe('compareFingerprints — six named single-mutation red states', () => {
  const baselineFp = fingerprintPayload(DATA_URL, apiDataCapture);

  // Note: mutating a section also flips the whole-payload hash, so each of (1)-(3) additionally
  // yields a `payload-changed` diff alongside the named section diff — asserted explicitly here
  // rather than filtered away, so the fixture's own consistency is part of the proof.

  it('(1) one byte changed inside one section (fases) ⇒ section-changed naming "fases"', () => {
    const mutated = structuredClone(apiDataCapture);
    mutated.fases = { ...mutated.fases, __probe: 1 };
    const observedFp = fingerprintPayload(DATA_URL, mutated);
    const diffs = compareFingerprints(baselineFp, observedFp);
    expect(diffs).toEqual([
      {
        kind: 'section-changed',
        section: 'fases',
        baselineSha256: baselineFp.sectionSha256.fases,
        observedSha256: observedFp.sectionSha256.fases,
      },
      {
        kind: 'payload-changed',
        section: null,
        baselineSha256: baselineFp.payloadSha256,
        observedSha256: observedFp.payloadSha256,
      },
    ]);
  });

  it('(2) a top-level section is added ⇒ section-added naming the new section', () => {
    const mutated = structuredClone(apiDataCapture);
    mutated.novaSecao = { probe: true };
    const observedFp = fingerprintPayload(DATA_URL, mutated);
    const diffs = compareFingerprints(baselineFp, observedFp);
    expect(diffs).toEqual([
      {
        kind: 'section-added',
        section: 'novaSecao',
        baselineSha256: null,
        observedSha256: observedFp.sectionSha256.novaSecao,
      },
      {
        kind: 'payload-changed',
        section: null,
        baselineSha256: baselineFp.payloadSha256,
        observedSha256: observedFp.payloadSha256,
      },
    ]);
  });

  it('(3) a top-level section is removed ⇒ section-removed naming the missing section', () => {
    const mutated = structuredClone(apiDataCapture);
    delete mutated.gemas;
    const observedFp = fingerprintPayload(DATA_URL, mutated);
    const diffs = compareFingerprints(baselineFp, observedFp);
    expect(diffs).toEqual([
      {
        kind: 'section-removed',
        section: 'gemas',
        baselineSha256: baselineFp.sectionSha256.gemas,
        observedSha256: null,
      },
      {
        kind: 'payload-changed',
        section: null,
        baselineSha256: baselineFp.payloadSha256,
        observedSha256: observedFp.payloadSha256,
      },
    ]);
  });

  it('(4) top-level keys reordered, no value change ⇒ payload-changed ALONE, zero section-changed', () => {
    const reordered = {};
    for (const key of [...Object.keys(apiDataCapture)].reverse()) {
      reordered[key] = apiDataCapture[key];
    }
    const observedFp = fingerprintPayload(DATA_URL, reordered);
    // Section-level hashes are untouched by reordering — only the whole-payload hash flips.
    expect(observedFp.sectionSha256).toEqual(baselineFp.sectionSha256);
    expect(observedFp.payloadSha256).not.toBe(baselineFp.payloadSha256);

    const diffs = compareFingerprints(baselineFp, observedFp);
    expect(diffs).toEqual([
      {
        kind: 'payload-changed',
        section: null,
        baselineSha256: baselineFp.payloadSha256,
        observedSha256: observedFp.payloadSha256,
      },
    ]);
    expect(diffs.filter((d) => d.kind === 'section-changed')).toEqual([]);
  });

  it('(5) itens.versao_catalogo changes 4 → 5', () => {
    const mutated = structuredClone(apiDataCapture);
    mutated.itens = { ...mutated.itens, versao_catalogo: 5 };
    const observedFp = fingerprintPayload(DATA_URL, mutated);
    const diffs = compareFingerprints(baselineFp, observedFp);
    const versaoDiff = diffs.find((d) => d.kind === 'versao-catalogo-changed');
    expect(versaoDiff).toEqual({ kind: 'versao-catalogo-changed', section: null, from: 4, to: 5 });
  });

  it('(6) itens.versao_catalogo is deleted ⇒ 4 → null', () => {
    const mutated = structuredClone(apiDataCapture);
    delete mutated.itens.versao_catalogo;
    const observedFp = fingerprintPayload(DATA_URL, mutated);
    const diffs = compareFingerprints(baselineFp, observedFp);
    const versaoDiff = diffs.find((d) => d.kind === 'versao-catalogo-changed');
    expect(versaoDiff).toEqual({ kind: 'versao-catalogo-changed', section: null, from: 4, to: null });
  });
});

describe('compareFingerprints — MWD-09: whole sectionNames list, no allowlist, no subset', () => {
  it('a baseline that omits one observed section yields section-added, not silence', () => {
    const baselineFp = fingerprintPayload(DATA_URL, apiDataCapture);
    const shrunkBaselineFp = {
      ...baselineFp,
      sectionNames: baselineFp.sectionNames.filter((n) => n !== 'skill_tree'),
      sectionSha256: Object.fromEntries(
        Object.entries(baselineFp.sectionSha256).filter(([k]) => k !== 'skill_tree'),
      ),
    };
    const observedFp = fingerprintPayload(DATA_URL, structuredClone(apiDataCapture));
    const diffs = compareFingerprints(shrunkBaselineFp, observedFp);
    expect(diffs).toContainEqual({
      kind: 'section-added',
      section: 'skill_tree',
      baselineSha256: null,
      observedSha256: observedFp.sectionSha256.skill_tree,
    });
  });
});

// =============================================================================================
// readBaseline — baseline-missing for every invalid shape (MWD-13)
// =============================================================================================

describe('readBaseline — the green path', () => {
  it('a well-formed baseline round-trips to ok:true with the same endpoints', () => {
    const baseline = validBaseline();
    const result = readBaseline(serializeBaseline(baseline));
    expect(result.ok).toBe(true);
    expect(result.baseline.endpoints.data.sectionNames).toEqual(baseline.endpoints.data.sectionNames);
  });
});

describe('readBaseline — baseline-missing red states, each its own assertion (MWD-13)', () => {
  it('absent (no text at all) ⇒ baseline-missing', () => {
    expect(readBaseline(undefined).ok).toBe(false);
  });

  it('unreadable (fs read failed for any other reason) ⇒ baseline-missing', () => {
    expect(readBaseline(null).ok).toBe(false);
  });

  it('unparseable JSON ⇒ baseline-missing', () => {
    expect(readBaseline('{not valid json').ok).toBe(false);
  });

  it('not a plain object (a JSON array) ⇒ baseline-missing', () => {
    expect(readBaseline('[1,2,3]').ok).toBe(false);
  });

  it('not a plain object (a JSON string) ⇒ baseline-missing', () => {
    expect(readBaseline('"hello"').ok).toBe(false);
  });

  it('schemaVersion !== 1 ⇒ baseline-missing', () => {
    const baseline = { ...validBaseline(), schemaVersion: 2 };
    expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
  });

  it('endpoints.data entry missing ⇒ baseline-missing', () => {
    const baseline = validBaseline();
    delete baseline.endpoints.data;
    expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
  });

  it('endpoints.fasesNomes entry missing ⇒ baseline-missing', () => {
    const baseline = validBaseline();
    delete baseline.endpoints.fasesNomes;
    expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
  });

  const fields = ['url', 'payloadSha256', 'sectionNames', 'sectionSha256', 'versaoCatalogo'];

  for (const field of fields) {
    it(`endpoints.data.${field} missing ⇒ baseline-missing`, () => {
      const baseline = validBaseline();
      delete baseline.endpoints.data[field];
      expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
    });

    it(`endpoints.data.${field} of the wrong type ⇒ baseline-missing`, () => {
      const baseline = validBaseline();
      // `versaoCatalogo` legitimately allows both number and null — an array is wrong for all five.
      baseline.endpoints.data[field] = ['wrong-type'];
      expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
    });
  }

  it('sectionNames empty ([]) ⇒ baseline-missing, never ok (the vacuity case)', () => {
    const baseline = validBaseline();
    baseline.endpoints.data.sectionNames = [];
    baseline.endpoints.data.sectionSha256 = {};
    const result = readBaseline(JSON.stringify(baseline));
    expect(result.ok).toBe(false);
    expect(result).not.toEqual(expect.objectContaining({ ok: true }));
  });

  it('sectionNames not deep-equal to Object.keys(sectionSha256).sort() ⇒ baseline-missing', () => {
    const baseline = validBaseline();
    baseline.endpoints.data.sectionNames = [...baseline.endpoints.data.sectionNames, 'phantom'];
    expect(readBaseline(JSON.stringify(baseline)).ok).toBe(false);
  });
});

// =============================================================================================
// serializeBaseline — deterministic emission, byte round-trip (MWD-36)
// =============================================================================================

describe('serializeBaseline — deterministic emission (MWD-36)', () => {
  it('emits sorted keys, 2-space indent, trailing newline', () => {
    const text = serializeBaseline(validBaseline());
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toMatch(/^\{\n  "capturedAt"/);
  });

  it('byte round-trip: serialize(read(serialize(b)).baseline) === serialize(b)', () => {
    const baseline = validBaseline();
    const once = serializeBaseline(baseline);
    const read = readBaseline(once);
    expect(read.ok).toBe(true);
    const twice = serializeBaseline(read.baseline);
    expect(twice).toBe(once);
  });
});
