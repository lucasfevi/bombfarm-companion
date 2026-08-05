import { describe, expect, it } from 'vitest';
import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { compareCandidates } from '@/features/import/model/compare-candidates';

function cand(
  partial: Partial<ImportCandidate> & Pick<ImportCandidate, 'name' | 'sourceId'>,
): ImportCandidate {
  return {
    level: 1,
    rarity: 'Comum',
    rank: 'E',
    power: 100,
    abilityCount: 0,
    gearCount: 0,
    issues: [],
    pointIssues: [],
    blocked: false,
    matchedExistingId: null,
    matchedExistingName: null,
    isGearRefresh: false,
    record: { name: partial.name, sourceId: partial.sourceId } as ImportCandidate['record'],
    ...partial,
  };
}

describe('compareCandidates', () => {
  it('sorts by power ascending', () => {
    const a = cand({ sourceId: 'a', name: 'A', power: 10 });
    const b = cand({ sourceId: 'b', name: 'B', power: 20 });
    expect(compareCandidates(a, b, 'power', 'asc')).toBeLessThan(0);
    expect(compareCandidates(a, b, 'power', 'desc')).toBeGreaterThan(0);
  });

  it('ties break with localeCompare on name', () => {
    const a = cand({ sourceId: 'a', name: 'Alpha', power: 50 });
    const b = cand({ sourceId: 'b', name: 'Beta', power: 50 });
    expect(compareCandidates(a, b, 'power', 'asc')).toBe(
      'Alpha'.localeCompare('Beta', undefined, { sensitivity: 'base' }),
    );
  });

  it('sorts name with base sensitivity', () => {
    const a = cand({ sourceId: 'a', name: 'ábc' });
    const b = cand({ sourceId: 'b', name: 'Abd' });
    expect(compareCandidates(a, b, 'name', 'asc')).toBe(
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  it('sorts by gear count', () => {
    const a = cand({ sourceId: 'a', name: 'A', gearCount: 2 });
    const b = cand({ sourceId: 'b', name: 'B', gearCount: 8 });
    expect(compareCandidates(a, b, 'gear', 'asc')).toBeLessThan(0);
    expect(compareCandidates(a, b, 'gear', 'desc')).toBeGreaterThan(0);
  });
});
