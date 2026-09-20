import { beforeEach, describe, expect, it } from 'vitest';
import { registerScreenRefresh, resetScreenRefreshForTests, screenRefreshOf, type ScreenRefreshState } from './screen-refresh-store';

function state(overrides: Partial<ScreenRefreshState> = {}): ScreenRefreshState {
  return { capturedAt: null, stale: false, busy: false, readState: { kind: 'idle' }, onRefresh: () => {}, ...overrides };
}

describe('the screen refresh registry — one entry per tab, held only while its screen is mounted', () => {
  beforeEach(() => {
    resetScreenRefreshForTests();
  });

  it('a tab with no registered screen reads as null, so the bar falls back to the live account read', () => {
    expect(screenRefreshOf('heroes')).toBeNull();
  });

  it('a registered screen is read back by its tab id, and no other', () => {
    const farm = state({ stale: true });
    registerScreenRefresh('farm', farm);
    expect(screenRefreshOf('farm')).toBe(farm);
    expect(screenRefreshOf('forge')).toBeNull();
  });

  it('unregistering removes the entry, so a tab whose screen has unmounted falls back again', () => {
    const unregister = registerScreenRefresh('farm', state());
    unregister();
    expect(screenRefreshOf('farm')).toBeNull();
  });

  // The registration re-runs as a screen's parts move (a press, a compute, a new read), and
  // React runs the old effect's cleanup only after the new one has registered when the deps
  // change in the same commit — but it can also run it before, on a remount. Either order must
  // leave the newest state in place, never a hole.
  it("a stale unregister never removes a newer registration under the same tab", () => {
    const first = state();
    const second = state({ busy: true });
    const unregisterFirst = registerScreenRefresh('farm', first);
    registerScreenRefresh('farm', second);
    unregisterFirst();
    expect(screenRefreshOf('farm')).toBe(second);
  });

  it('re-registering replaces the entry in place', () => {
    registerScreenRefresh('pvp', state());
    const next = state({ readState: { kind: 'working' } });
    registerScreenRefresh('pvp', next);
    expect(screenRefreshOf('pvp')).toBe(next);
  });
});
