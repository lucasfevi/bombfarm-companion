import { describe, expect, it } from 'vitest';
import type { AccountPayload, CommitVector } from '@bombfarm/contracts';
import type { HeroDetailReading } from '@bombfarm/game-api';
import { FAILED_READ_RETRY_MS, createServerAllocations } from './server-allocations.js';

const ALLOC = [10, 0, 5, 0, 0, 0, 0, 3] as unknown as CommitVector;

function payload(level = 18): AccountPayload {
  return {
    heroes: [
      { id: 'capped', level, stat_points_available: 0, stats: { cooldown_reduction: 60 } },
      { id: 'exact', level: 30, stat_points_available: 0, stats: { dmg: 40 } },
    ],
    items: [],
  };
}

function reader(reading: HeroDetailReading = { kind: 'ok', alloc: ALLOC, spent: 18, available: 0, respecGold: null }) {
  const asked: string[] = [];
  const read = (heroId: string) => {
    asked.push(heroId);
    return Promise.resolve(reading);
  };
  return { read, asked };
}

describe('createServerAllocations', () => {
  it('reads only the named heroes the payload holds, and attaches each reading', async () => {
    const allocations = createServerAllocations();
    const { read, asked } = reader();

    expect(await allocations.read(payload(), ['capped', 'gone'], read)).toBe(true);
    expect(asked).toEqual(['capped']);
    expect(allocations.withCached(payload()).heroes).toEqual([
      { id: 'capped', level: 18, stat_points_available: 0, stats: { cooldown_reduction: 60 }, alloc: ALLOC },
      { id: 'exact', level: 30, stat_points_available: 0, stats: { dmg: 40 } },
    ]);
  });

  it('keeps a reading while the hero is unchanged, and drops it once the hero levels', async () => {
    const allocations = createServerAllocations();
    const { read, asked } = reader();
    await allocations.read(payload(), ['capped'], read);

    expect(await allocations.read(payload(), ['capped'], read)).toBe(false);
    expect(asked).toEqual(['capped']);
    expect(allocations.withCached(payload(19)).heroes?.[0]).not.toHaveProperty('alloc');

    await allocations.read(payload(19), ['capped'], read);
    expect(asked).toEqual(['capped', 'capped']);
  });

  it('does not retry a failed reading for the same sheet until the retry window passes', async () => {
    let now = 1_000;
    const allocations = createServerAllocations(() => now);
    const { read, asked } = reader({ kind: 'failed', reason: 'cooldown' });

    expect(await allocations.read(payload(), ['capped'], read)).toBe(false);
    await allocations.read(payload(), ['capped'], read);
    expect(asked).toEqual(['capped']);

    now += FAILED_READ_RETRY_MS;
    await allocations.read(payload(), ['capped'], read);
    expect(asked).toEqual(['capped', 'capped']);
  });

  it('treats a reading that throws as failed and leaves the payload as it was', async () => {
    const allocations = createServerAllocations();
    expect(await allocations.read(payload(), ['capped'], () => Promise.reject(new Error('aborted')))).toBe(false);
    expect(allocations.withCached(payload())).toEqual(payload());
  });
});
