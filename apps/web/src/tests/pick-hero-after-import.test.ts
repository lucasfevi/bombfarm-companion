import { describe, expect, it } from 'vitest';
import { pickHeroAfterImport } from '@bombfarm/domain/pick-hero-after-import';
import type { HeroRecord } from '@/shared/lib/storage';

function hero(id: string, power: number): HeroRecord {
  return { id, name: id, updatedAt: 0, power } as HeroRecord;
}

describe('pickHeroAfterImport', () => {
  const merged = [hero('a', 100), hero('b', 200)];

  it('reapplies the active hero when present in merged', () => {
    expect(pickHeroAfterImport(merged, 'a')?.id).toBe('a');
  });

  it('returns null when the active hero is not in merged', () => {
    expect(pickHeroAfterImport(merged, 'missing')).toBeNull();
  });

  it('selects highest power when editor has no active hero', () => {
    expect(pickHeroAfterImport(merged, null)?.id).toBe('b');
  });

  it('returns null for an empty merged roster without an active hero', () => {
    expect(pickHeroAfterImport([], null)).toBeNull();
  });
});
