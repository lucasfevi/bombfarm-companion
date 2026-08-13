// ACS-01: proves the source-neutral entry point split preserves `parseSaveFile`'s observable
// behaviour byte-for-byte — `parseSaveFile` and `parseAccountPayload` still agree on every
// canonical fixture. MP5 F1 (`AD-068`): the pre-refactor inline `ParseResult` digests (ACS-02)
// and the `vera-01-points-reset.json` warnings snapshot are DELETED here, not regenerated —
// they were SHA-256 hashes / a golden snapshot of *our own output* captured against a
// pre-refactor HEAD and a since-deleted pre-wipe account. Re-hashing or re-snapshotting them
// against a new fixture would assert nothing at all (a value produced by running
// `@bombfarm/domain` and pasted back in as an expected value is a violation, not a baseline).
// The `__snapshots__/account-source-parity.test.ts.snap` file (whose only entry was the deleted
// warnings snapshot) is deleted in the same commit.
import { describe, expect, it } from 'vitest';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';
import { deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import { minimalHero } from './helpers/minimal-save-hero';

// MP5 F1 (AD-068 class (b) — structural): re-pointed onto the post-patch corpus. The claim
// itself (`parseSaveFile` ≡ `parseAccountPayload`) is unchanged; only the fixture names moved.
const CANONICAL_FIXTURES = ['save-20260813-5heroes.json', 'payload-20260812-8heroes.json'] as const;

describe('parseAccountPayload and parseSaveFile agree on every canonical fixture (ACS-01)', () => {
  for (const fixture of CANONICAL_FIXTURES) {
    it(`${fixture}: identical ParseResult with an empty existing[]`, () => {
      const raw = loadFixtureJson(fixture);
      expect(parseSaveFile(raw, [])).toEqual(parseAccountPayload(raw, []));
    });
  }

  it('save-20260813-5heroes.json: identical ParseResult with a non-empty existing[] (isGearRefresh / matchedExistingId)', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const heroes = Array.isArray(raw.heroes) ? raw.heroes : [];
    const firstSourceId = heroes
      .map((hero) => (typeof hero === 'object' && hero !== null ? (hero as Record<string, unknown>).id : undefined))
      .find((id): id is string => typeof id === 'string');
    if (!firstSourceId) throw new Error('fixture has no hero id to seed `existing` with');

    const existing: HeroRecord[] = [
      {
        id: 'existing-1',
        sourceId: firstSourceId,
        name: 'Pre-existing',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as HeroRecord,
    ];

    const viaFile = parseSaveFile(raw, existing);
    const viaEntryPoint = parseAccountPayload(raw, existing);
    expect(viaFile).toEqual(viaEntryPoint);
    // Sanity: this fixture/existing combination actually exercises the gear-refresh branch —
    // otherwise the assertion above would pass trivially without covering it.
    expect(viaFile.candidates.some((candidate) => candidate.isGearRefresh)).toBe(true);
    expect(viaFile.candidates.some((candidate) => candidate.matchedExistingId === 'existing-1')).toBe(true);
  });
});

describe('rejections are preserved through the seam (ACS-03)', () => {
  it('heroes omitted: notASaveFile through both entry points', () => {
    const payload = { not_a_save: true };
    const viaFile = parseSaveFile(payload, []);
    const viaEntryPoint = parseAccountPayload(payload, []);
    expect(viaFile.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaFile).toEqual(viaEntryPoint);
  });

  it('heroes not an array: notASaveFile through both entry points', () => {
    const payload = { heroes: 'not-an-array' };
    const viaFile = parseSaveFile(payload, []);
    const viaEntryPoint = parseAccountPayload(payload, []);
    expect(viaFile.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaFile).toEqual(viaEntryPoint);
  });

  it('payload is null: notASaveFile through both entry points, never throws', () => {
    const viaFile = parseSaveFile(null, []);
    const viaEntryPoint = parseAccountPayload(null, []);
    expect(viaFile.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaFile).toEqual(viaEntryPoint);
  });

  it('payload is a non-object (number): notASaveFile through both entry points, never throws', () => {
    const viaFile = parseSaveFile(42, []);
    const viaEntryPoint = parseAccountPayload(42, []);
    expect(viaFile.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'notASaveFile', heroNames: [] });
    expect(viaFile).toEqual(viaEntryPoint);
  });

  it('one hero missing birth_stats: missingBirthStats naming that hero, through both entry points', () => {
    const payload = {
      heroes: [{ id: '1', name: 'NoBirth' }, minimalHero('2', 'HasBirth')],
    };
    const viaFile = parseSaveFile(payload, []);
    const viaEntryPoint = parseAccountPayload(payload, []);
    expect(viaFile.rejected).toEqual({ reason: 'missingBirthStats', heroNames: ['NoBirth'] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'missingBirthStats', heroNames: ['NoBirth'] });
    expect(viaFile).toEqual(viaEntryPoint);
  });

  it('mixed save (some heroes have birth_stats, some do not): rejects with every missing name, through both entry points', () => {
    const payload = {
      heroes: [
        { id: '1', name: 'NoBirthA' },
        minimalHero('2', 'HasBirth'),
        { id: '3', name: 'NoBirthB' },
      ],
    };
    const viaFile = parseSaveFile(payload, []);
    const viaEntryPoint = parseAccountPayload(payload, []);
    expect(viaFile.rejected).toEqual({ reason: 'missingBirthStats', heroNames: ['NoBirthA', 'NoBirthB'] });
    expect(viaEntryPoint.rejected).toEqual({ reason: 'missingBirthStats', heroNames: ['NoBirthA', 'NoBirthB'] });
    expect(viaFile).toEqual(viaEntryPoint);
  });
});

describe('edge cases (spec.md Edge Cases)', () => {
  it('items absent: existing warning, parsing continues', () => {
    const payload = { heroes: [minimalHero('1')] };
    const { warnings, rejected, candidates } = parseSaveFile(payload, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(1);
    expect(warnings.some((warning) => warning.includes('no "items" list'))).toBe(true);
  });

  it('skills/casa absent: tree/houseIdx/houseLevel stay null (MOD-36)', () => {
    const payload = { heroes: [minimalHero('1')] };
    const { account } = parseSaveFile(payload, []);
    expect(account.tree).toBeNull();
    expect(account.houseIdx).toBeNull();
    expect(account.houseLevel).toBeNull();
  });

  it('a stale-marked section parses normally through the entry point (staleness is not a parse gate)', () => {
    const payload = {
      heroes: [minimalHero('1')],
      fidelity: {
        account: { status: 'stale' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
        heroes: { status: 'stale' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
        skills: { status: 'stale' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
        casa: { status: 'stale' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
        items: { status: 'stale' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
      },
    };
    const { rejected, candidates } = parseAccountPayload(payload, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(1);
  });

  it('a resolved-but-absent section warns without changing warnings on the file path (payload.fidelity undefined)', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const { warnings } = parseSaveFile(raw, []);
    // The file adapter never sets `fidelity`, so the resolved-but-absent warning can never
    // fire on this path — provably empty of that warning text.
    expect(warnings.some((warning) => warning.includes('reports') && warning.includes('resolved but'))).toBe(
      false,
    );
  });

  it('a resolved-but-absent section warns without silently downgrading the derived grade (spec.md edge case, TD-6)', () => {
    const fidelity = {
      account: { status: 'resolved' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
      heroes: { status: 'resolved' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
      skills: { status: 'resolved' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
      // "casa" is asserted resolved, but the payload carries no `casa` key at all.
      casa: { status: 'resolved' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
      items: { status: 'resolved' as const, capturedAt: '2026-08-12T00:00:00.000Z' },
    };
    const payload = { heroes: [minimalHero('1')], fidelity };
    const { warnings, candidates, rejected } = parseAccountPayload(payload, []);
    expect(rejected).toBeNull();
    expect(candidates).toHaveLength(1);
    expect(
      warnings.some(
        (warning) => warning.includes('"casa"') && warning.includes('resolved') && warning.includes('no'),
      ),
    ).toBe(true);
    // The grade stays a pure function of `fidelity` alone (TD-6/TD-7) — it is computed
    // separately, never read off ParseResult — so "all resolved" still grades `full` even
    // though one of those sections had nothing to back it up. The warning is the ONLY
    // signal of the mismatch; the grade itself is never silently downgraded.
    expect(deriveAccountFidelity(fidelity)).toEqual({ grade: 'full', degradedSections: [] });
  });
});

describe('file-only fields stay in the adapter (ACS-06.2)', () => {
  it('a file object carrying export_version/generated_at parses identically to one without them', () => {
    const withFileFields = {
      export_version: 3,
      generated_at: '2026-08-12T00:00:00.000Z',
      heroes: [minimalHero('1')],
    };
    const withoutFileFields = { heroes: [minimalHero('1')] };
    expect(parseSaveFile(withFileFields, [])).toEqual(parseSaveFile(withoutFileFields, []));
  });
});
