import { READ_PACING } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import { createTriggeredRefresh } from './triggered-refresh.js';

function harness(floorMs?: number) {
  let nowMs = 0;
  let refreshCount = 0;
  const trigger = createTriggeredRefresh({
    refreshNow: () => {
      refreshCount += 1;
      return Promise.resolve(null);
    },
    now: () => nowMs,
    ...(floorMs !== undefined ? { floorMs } : {}),
  });
  return {
    trigger,
    advance: (ms: number) => {
      nowMs += ms;
    },
    getRefreshCount: () => refreshCount,
  };
}

describe('createTriggeredRefresh', () => {
  it('the first notify always triggers a refresh', () => {
    const { trigger, getRefreshCount } = harness(10_000);

    trigger.notify();

    expect(getRefreshCount()).toBe(1);
  });

  it('a burst of notify() calls inside the floor produces exactly one refresh, however many calls arrive', () => {
    const { trigger, getRefreshCount } = harness(10_000);

    for (let i = 0; i < 50; i += 1) trigger.notify();

    expect(getRefreshCount()).toBe(1);
  });

  it('a notify after the floor has elapsed triggers exactly one more refresh', () => {
    const { trigger, advance, getRefreshCount } = harness(10_000);

    trigger.notify();
    advance(10_000);
    trigger.notify();

    expect(getRefreshCount()).toBe(2);
  });

  it('a notify one millisecond short of the floor is still refused', () => {
    const { trigger, advance, getRefreshCount } = harness(10_000);

    trigger.notify();
    advance(9_999);
    trigger.notify();

    expect(getRefreshCount()).toBe(1);
  });

  it("defaults to READ_PACING.manualRefreshFloorMs — never exceedable by how often membership churns", () => {
    const { trigger, advance, getRefreshCount } = harness();

    trigger.notify();
    advance(READ_PACING.manualRefreshFloorMs - 1);
    trigger.notify();
    expect(getRefreshCount()).toBe(1);

    advance(1);
    trigger.notify();
    expect(getRefreshCount()).toBe(2);
  });
});
