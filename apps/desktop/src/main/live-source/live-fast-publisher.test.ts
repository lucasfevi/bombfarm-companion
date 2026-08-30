import { LIVE_DISPLAY_REFRESH_MS, type FieldCountdown, type LiveEarnings, type LiveEvent, type LiveHeroEnergy, type LiveView, type RecoveryCountdown, type RotationSnapshot } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  createLiveFastPublisher,
  createRotationOnFieldIdsCache,
  hasFieldMembershipDiverged,
  sameIdList,
} from './live-fast-publisher.js';

type ViewSlice = Pick<LiveView, 'field' | 'recovery' | 'energies' | 'onFieldHeroIds' | 'rotation' | 'earnings' | 'map'>;

function view(overrides: Partial<ViewSlice> = {}): ViewSlice {
  return { field: [], recovery: [], energies: [], onFieldHeroIds: [], rotation: null, earnings: null, map: null, ...overrides };
}

function earnings(overrides: Partial<LiveEarnings> = {}): LiveEarnings {
  return {
    goldBalance: 1_000,
    goldBalanceCapturedAt: null,
    gold10: 1_000,
    goldSession: 1_000,
    xp10: 100,
    xpSession: 100,
    goldSessionTotal: 1_000,
    xpSessionTotal: 100,
    coverageSeconds: 60,
    sessionSeconds: 60,
    ...overrides,
  };
}

function harness(getView: () => ViewSlice, onFieldMembershipDiverged?: () => void) {
  let tick: (() => void) | null = null;
  const emitted: LiveEvent[] = [];
  const publisher = createLiveFastPublisher({
    getView,
    emit: (event) => emitted.push(event),
    scheduler: {
      schedule: (callback) => {
        tick = callback;
        return () => {
          tick = null;
        };
      },
    },
    ...(onFieldMembershipDiverged !== undefined ? { onFieldMembershipDiverged } : {}),
  });
  return { publisher, emitted, fireTick: () => tick?.() };
}

describe('createLiveFastPublisher — publishes only when the fast channel actually changed', () => {
  it('an idle account with nothing changing publishes exactly once, never again on later polls', () => {
    const stableView = view({
      field: [],
      recovery: [],
      onFieldHeroIds: [],
      rotation: { heroes: [] },
    });
    const { publisher, emitted, fireTick } = harness(() => stableView);
    publisher.start();

    for (let i = 0; i < 20; i += 1) fireTick();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ type: 'fastUpdate', field: [], recovery: [], energies: [], onFieldHeroIds: [], earnings: null, map: null });
  });

  it('a genuine change in field countdowns republishes; an unrelated re-poll with identical content does not', () => {
    let field: readonly FieldCountdown[] = [{ heroId: 'h1', secondsRemaining: 10, drainPerSecond: 1, basis: 'observed' }];
    const { publisher, emitted, fireTick } = harness(() => view({ field }));
    publisher.start();

    fireTick();
    fireTick();
    expect(emitted).toHaveLength(1);

    field = [{ heroId: 'h1', secondsRemaining: 9, drainPerSecond: 1, basis: 'observed' }];
    fireTick();
    expect(emitted).toHaveLength(2);

    fireTick();
    expect(emitted).toHaveLength(2);
  });

  it('a change in onFieldHeroIds alone republishes, even with field and recovery unchanged', () => {
    let onFieldHeroIds: readonly string[] = ['h1'];
    const { publisher, emitted, fireTick } = harness(() => view({ onFieldHeroIds }));
    publisher.start();
    fireTick();
    expect(emitted).toHaveLength(1);

    onFieldHeroIds = ['h1', 'h2'];
    fireTick();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ type: 'fastUpdate', onFieldHeroIds: ['h1', 'h2'] });
  });

  it('a recovery-only change (advancing flips) also republishes', () => {
    let recovery: readonly RecoveryCountdown[] = [{ heroId: 'h1', secondsRemaining: 5, advancing: true }];
    const { publisher, emitted, fireTick } = harness(() => view({ recovery }));
    publisher.start();
    fireTick();

    recovery = [{ heroId: 'h1', secondsRemaining: 5, advancing: false }];
    fireTick();

    expect(emitted).toHaveLength(2);
  });

  it('carries earnings through as a finished value, unchanged from what getView returned', () => {
    const value = earnings({ goldBalance: 12_345, gold10: 6_000, xpSession: 42 });
    const { publisher, emitted, fireTick } = harness(() => view({ earnings: value }));
    publisher.start();
    fireTick();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ type: 'fastUpdate', earnings: value });
  });

  it('a change confined to the session totals still republishes, even with every rate and window field unchanged', () => {
    let currentEarnings = earnings({ goldSessionTotal: 1_000, xpSessionTotal: 100 });
    const { publisher, emitted, fireTick } = harness(() => view({ earnings: currentEarnings }));
    publisher.start();
    fireTick();
    expect(emitted).toHaveLength(1);

    currentEarnings = earnings({ goldSessionTotal: 2_000, xpSessionTotal: 100 });
    fireTick();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ type: 'fastUpdate', earnings: currentEarnings });
  });

  it('an earnings-only change republishes, even with field/recovery/onFieldHeroIds unchanged', () => {
    let currentEarnings: LiveEarnings | null = null;
    const { publisher, emitted, fireTick } = harness(() => view({ earnings: currentEarnings }));
    publisher.start();
    fireTick();
    expect(emitted).toHaveLength(1);

    currentEarnings = earnings();
    fireTick();

    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ type: 'fastUpdate', earnings: currentEarnings });
  });

  it('the publish cadence is unchanged: still one scheduled callback at the same interval, earnings included', () => {
    let scheduledIntervalMs: number | null = null;
    const emitted: LiveEvent[] = [];
    let tick: (() => void) | null = null;
    const publisher = createLiveFastPublisher({
      getView: () => view({ earnings: earnings() }),
      emit: (event) => emitted.push(event),
      scheduler: {
        schedule: (callback, intervalMs) => {
          scheduledIntervalMs = intervalMs;
          tick = callback;
          return () => {
            tick = null;
          };
        },
      },
    });
    publisher.start();
    const fireTick = () => tick?.();

    expect(scheduledIntervalMs).toBe(LIVE_DISPLAY_REFRESH_MS);
    fireTick();
    expect(emitted).toHaveLength(1);
  });

  it('stop() cancels the schedule — a later manual tick call is a no-op', () => {
    const { publisher, emitted, fireTick } = harness(() => view());
    publisher.start();
    publisher.stop();

    fireTick();

    expect(emitted).toHaveLength(0);
  });
});

describe('createLiveFastPublisher — divergence watch', () => {
  const rotation: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }] };

  it('calls onFieldMembershipDiverged every poll the live set disagrees with the snapshot', () => {
    let divergedCount = 0;
    const { publisher, fireTick } = harness(
      () => view({ rotation, onFieldHeroIds: [] }),
      () => {
        divergedCount += 1;
      },
    );
    publisher.start();

    fireTick();
    fireTick();

    expect(divergedCount).toBe(2);
  });

  it('never calls it while the live set agrees with the snapshot', () => {
    let divergedCount = 0;
    const { publisher, fireTick } = harness(
      () => view({ rotation, onFieldHeroIds: ['h1'] }),
      () => {
        divergedCount += 1;
      },
    );
    publisher.start();

    fireTick();

    expect(divergedCount).toBe(0);
  });
});

describe('hasFieldMembershipDiverged', () => {
  it('is false with no rotation read yet, however the live set looks', () => {
    expect(hasFieldMembershipDiverged(view({ rotation: null, onFieldHeroIds: ['h1'] }))).toBe(false);
  });

  it('is false when the live set exactly matches the snapshot-declared on-field set', () => {
    const rotation: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }, { id: 'h2', activity: 'benched' }] };
    expect(hasFieldMembershipDiverged(view({ rotation, onFieldHeroIds: ['h1'] }))).toBe(false);
  });

  it('is true when a hero the snapshot calls inField is absent from the live set', () => {
    const rotation: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }] };
    expect(hasFieldMembershipDiverged(view({ rotation, onFieldHeroIds: [] }))).toBe(true);
  });

  it('is true when the live set names a hero the snapshot does not have on the field', () => {
    const rotation: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'benched' }] };
    expect(hasFieldMembershipDiverged(view({ rotation, onFieldHeroIds: ['h1'] }))).toBe(true);
  });
});

describe('createRotationOnFieldIdsCache', () => {
  it('returns the same Set reference for the same rotation reference, and a new one for a different reference', () => {
    const cache = createRotationOnFieldIdsCache();
    const rotationA: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }] };
    const rotationB: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }] };

    const first = cache(rotationA);
    const second = cache(rotationA);
    const third = cache(rotationB);

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect([...third]).toEqual([...first]);
  });

  it('a poll against an unchanged rotation reuses the cache, so hasFieldMembershipDiverged never rebuilds a set it does not need to', () => {
    const rotation: RotationSnapshot = { heroes: [{ id: 'h1', activity: 'inField' }] };
    const cache = createRotationOnFieldIdsCache();

    const agreeing = hasFieldMembershipDiverged({ rotation, onFieldHeroIds: ['h1'] }, cache);
    const stillAgreeing = hasFieldMembershipDiverged({ rotation, onFieldHeroIds: ['h1'] }, cache);

    expect(agreeing).toBe(false);
    expect(stillAgreeing).toBe(false);
  });
});

describe('sameIdList', () => {
  it('is order-sensitive, matching how the source always emits a sorted id list', () => {
    expect(sameIdList(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameIdList(['a', 'b'], ['a', 'b'])).toBe(true);
  });
});

describe('createLiveFastPublisher — per-hero energy is part of the fast channel', () => {
  it('a changed energy fraction alone republishes, so the bar moves at the same cadence as the countdown', () => {
    const energies: LiveHeroEnergy[] = [{ heroId: 'h1', energyFraction: 0.5 }];
    let current: readonly LiveHeroEnergy[] = energies;
    const { publisher, emitted, fireTick } = harness(() => view({ energies: current }));

    publisher.start();
    fireTick();
    expect(emitted).toHaveLength(1);

    fireTick();
    expect(emitted).toHaveLength(1);

    current = [{ heroId: 'h1', energyFraction: 0.51 }];
    fireTick();
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toMatchObject({ type: 'fastUpdate', energies: [{ heroId: 'h1', energyFraction: 0.51 }] });
  });
});
