import { describe, expect, it } from 'vitest';
import {
  toastQueueReducer,
  initialToastQueueState,
  nextExpiryDeadline,
  MAX_VISIBLE_TOASTS,
  NOTIFICATION_BUFFER_LIMIT,
  type ToastInput,
  type ToastQueueState,
} from './toast-queue';

function push(state: ToastQueueState, toast: ToastInput, now: number): ToastQueueState {
  return toastQueueReducer(state, { type: 'push', toast, now });
}

function makeToast(overrides: Partial<ToastInput> & Pick<ToastInput, 'key'>): ToastInput {
  return { variant: 'info', title: overrides.key, ...overrides };
}

describe('toastQueueReducer — TST-02 coalescing', () => {
  it('replaces a toast with a matching key in place, preserving stack position', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a', title: 'A' }), 1000);
    state = push(state, makeToast({ key: 'b', title: 'B' }), 1001);
    state = push(state, makeToast({ key: 'c', title: 'C' }), 1002);
    // newest-first: [c, b, a]
    expect(state.all.map((t) => t.key)).toEqual(['c', 'b', 'a']);

    state = push(state, makeToast({ key: 'b', title: 'B updated' }), 1003);

    expect(state.all.map((t) => t.key)).toEqual(['c', 'b', 'a']);
    expect(state.all[1].title).toBe('B updated');
    expect(state.all.length).toBe(3);
  });

  it('preserves the original createdAt across a coalescing replace', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'price-pass' }), 5000);
    const originalCreatedAt = state.all[0].createdAt;

    state = push(state, makeToast({ key: 'price-pass', title: 'tick' }), 5999);

    expect(state.all[0].createdAt).toBe(originalCreatedAt);
    expect(state.all[0].createdAt).toBe(5000);
    expect(state.all[0].updatedAt).toBe(5999);
  });

  it('preserves the id across a coalescing replace', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'price-pass' }), 1);
    const id = state.all[0].id;

    state = push(state, makeToast({ key: 'price-pass', title: 'tick 2' }), 2);

    expect(state.all[0].id).toBe(id);
  });

  it('does not grow the queue when coalescing (count stays at 1)', () => {
    let state = initialToastQueueState;
    for (let i = 0; i < 5; i += 1) {
      state = push(state, makeToast({ key: 'k', title: `tick ${i}` }), i);
    }
    expect(state.all.length).toBe(1);
  });
});

describe('toastQueueReducer — TST-03 new-key insertion order', () => {
  it('inserts a toast with a new key newest-first', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 1);
    state = push(state, makeToast({ key: 'b' }), 2);
    expect(state.all.map((t) => t.key)).toEqual(['b', 'a']);

    state = push(state, makeToast({ key: 'c' }), 3);
    expect(state.all.map((t) => t.key)).toEqual(['c', 'b', 'a']);
  });
});

describe('toastQueueReducer — TST-04 overflow', () => {
  it('marks at most MAX_VISIBLE_TOASTS as visible with a correct overflowCount', () => {
    let state = initialToastQueueState;
    expect(MAX_VISIBLE_TOASTS).toBe(3);
    for (let i = 0; i < 4; i += 1) {
      state = push(state, makeToast({ key: `k${i}` }), i);
    }
    expect(state.visible.length).toBe(3);
    expect(state.overflow.length).toBe(1);
    expect(state.overflowCount).toBe(1);
  });

  it('reports overflowCount 3 with 6 toasts pushed', () => {
    let state = initialToastQueueState;
    for (let i = 0; i < 6; i += 1) {
      state = push(state, makeToast({ key: `k${i}` }), i);
    }
    expect(state.visible.length).toBe(3);
    expect(state.overflow.length).toBe(3);
    expect(state.overflowCount).toBe(3);
    // Visible is always the newest 3.
    expect(state.visible.map((t) => t.key)).toEqual(['k5', 'k4', 'k3']);
  });

  it('promotes the oldest overflow toast into the visible set after a dismiss', () => {
    let state = initialToastQueueState;
    for (let i = 0; i < 4; i += 1) {
      state = push(state, makeToast({ key: `k${i}` }), i);
    }
    // visible: [k3, k2, k1], overflow: [k0]
    const toDismiss = state.visible.find((t) => t.key === 'k1')!;
    state = toastQueueReducer(state, { type: 'dismiss', id: toDismiss.id });

    expect(state.visible.map((t) => t.key)).toEqual(['k3', 'k2', 'k0']);
    expect(state.overflow.length).toBe(0);
    expect(state.overflowCount).toBe(0);
  });
});

describe('toastQueueReducer — TST-05 explicit now', () => {
  it('never reads Date.now — identical actions replay deterministically regardless of wall-clock time', () => {
    let stateA = initialToastQueueState;
    stateA = push(stateA, makeToast({ key: 'a' }), 12345);
    let stateB = initialToastQueueState;
    stateB = push(stateB, makeToast({ key: 'a' }), 12345);
    expect(stateA.all[0].createdAt).toBe(stateB.all[0].createdAt);
    expect(stateA).toEqual(stateB);
  });
});

describe('toastQueueReducer — TST-06 expire()', () => {
  it('drops an elapsed info toast on expire(now)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'info-1', variant: 'info' }), 0);
    expect(state.all[0].expiresAt).toBe(4000);

    state = toastQueueReducer(state, { type: 'expire', now: 3999 });
    expect(state.all.length).toBe(1);

    state = toastQueueReducer(state, { type: 'expire', now: 4001 });
    expect(state.all.length).toBe(0);
  });

  it('drops an elapsed success toast on expire(now)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 's-1', variant: 'success' }), 0);
    state = toastQueueReducer(state, { type: 'expire', now: 4001 });
    expect(state.all.length).toBe(0);
  });

  it('never expires a warning toast on a timer', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'w-1', variant: 'warning' }), 0);
    expect(state.all[0].expiresAt).toBeNull();
    state = toastQueueReducer(state, { type: 'expire', now: 999_999_999 });
    expect(state.all.length).toBe(1);
  });

  it('never expires an error toast on a timer', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'e-1', variant: 'error' }), 0);
    expect(state.all[0].expiresAt).toBeNull();
    state = toastQueueReducer(state, { type: 'expire', now: 999_999_999 });
    expect(state.all.length).toBe(1);
  });

  it('never expires a progress toast on a timer', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'p-1', variant: 'progress', progress: 10 }), 0);
    expect(state.all[0].expiresAt).toBeNull();
    state = toastQueueReducer(state, { type: 'expire', now: 999_999_999 });
    expect(state.all.length).toBe(1);
  });

  it('ignores an explicit autoDismissMs override for warning/error/progress (hard policy)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'w-1', variant: 'warning', autoDismissMs: 100 }), 0);
    expect(state.all[0].expiresAt).toBeNull();
  });

  it('honours an explicit autoDismissMs override for info/success', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'i-1', variant: 'info', autoDismissMs: 10_000 }), 0);
    expect(state.all[0].expiresAt).toBe(10_000);
  });
});

describe('toastQueueReducer — TST-07 progress completion replaces by key', () => {
  it('a completion toast pushed with the same key replaces the progress toast in place', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'price-pass', variant: 'progress', title: 'Pricing…', progress: 40 }), 0);
    const progressEntry = state.all[0];
    expect(progressEntry.expiresAt).toBeNull();

    state = push(
      state,
      makeToast({ key: 'price-pass', variant: 'progress', title: 'Pricing…', progress: 100 }),
      500,
    );
    expect(state.all.length).toBe(1);
    expect(state.all[0].progress).toBe(100);

    // Caller replaces the progress toast with a completion summary of the same key (§11).
    state = push(
      state,
      makeToast({ key: 'price-pass', variant: 'success', title: 'Price pass complete' }),
      600,
    );

    expect(state.all.length).toBe(1);
    expect(state.all[0].id).toBe(progressEntry.id);
    expect(state.all[0].createdAt).toBe(progressEntry.createdAt);
    expect(state.all[0].variant).toBe('success');
    expect(state.all[0].title).toBe('Price pass complete');
    // The completion toast now picks up the success auto-dismiss default.
    expect(state.all[0].expiresAt).toBe(600 + 4000);
  });
});

describe('toastQueueReducer — TST-08 threshold-gated announce', () => {
  it('announces once when crossing from 49% to 51% (crosses the 50 threshold)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 49 }), 0);
    expect(state.announce).toBe(true); // first appearance always crosses the 0 threshold

    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 51 }), 1);
    expect(state.announce).toBe(true);
  });

  it('does not announce again for 51% to 52% (no threshold crossed)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 51 }), 0);
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 52 }), 1);
    expect(state.announce).toBe(false);
  });

  it('announces on reaching exactly 100%', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 90 }), 0);
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 100 }), 1);
    expect(state.announce).toBe(true);
  });

  it('never sets announce for non-progress toasts', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'i', variant: 'info' }), 0);
    expect(state.announce).toBe(false);
  });

  it('resets announce to false on dismiss/expire/clear', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'p', variant: 'progress', progress: 0 }), 0);
    expect(state.announce).toBe(true);
    state = toastQueueReducer(state, { type: 'dismiss', id: state.all[0].id });
    expect(state.announce).toBe(false);
  });
});

describe('toastQueueReducer — TST-09 dismiss', () => {
  it('removes exactly the toast with the matching id', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 0);
    state = push(state, makeToast({ key: 'b' }), 1);
    const idToRemove = state.all.find((t) => t.key === 'a')!.id;

    state = toastQueueReducer(state, { type: 'dismiss', id: idToRemove });

    expect(state.all.map((t) => t.key)).toEqual(['b']);
  });

  it('is a no-op for an unknown id', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 0);
    const before = state.all;
    state = toastQueueReducer(state, { type: 'dismiss', id: 'does-not-exist' });
    expect(state.all).toBe(before);
  });
});

describe('toastQueueReducer — TST-10 notification buffer', () => {
  it('appends every distinct toast to the buffer', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 0);
    state = push(state, makeToast({ key: 'b' }), 1);
    expect(state.buffer.map((t) => t.key)).toEqual(['b', 'a']);
  });

  it('caps the buffer at NOTIFICATION_BUFFER_LIMIT (50), evicting the oldest first', () => {
    expect(NOTIFICATION_BUFFER_LIMIT).toBe(50);
    let state = initialToastQueueState;
    for (let i = 0; i < 55; i += 1) {
      state = push(state, makeToast({ key: `k${i}`, title: `toast ${i}` }), i);
    }
    expect(state.buffer.length).toBe(50);
    // Newest-first; oldest 5 (k0..k4) evicted, k5..k54 remain.
    expect(state.buffer[0].key).toBe('k54');
    expect(state.buffer.at(-1)!.key).toBe('k5');
    expect(state.buffer.some((t) => t.key === 'k0')).toBe(false);
    expect(state.buffer.some((t) => t.key === 'k4')).toBe(false);
  });

  it('keeps a dismissed toast in the buffer (history is independent of the live stack)', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 0);
    const id = state.all[0].id;
    state = toastQueueReducer(state, { type: 'dismiss', id });
    expect(state.all.length).toBe(0);
    expect(state.buffer.length).toBe(1);
  });

  it('keeps an expired toast in the buffer', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a', variant: 'info' }), 0);
    state = toastQueueReducer(state, { type: 'expire', now: 5000 });
    expect(state.all.length).toBe(0);
    expect(state.buffer.length).toBe(1);
  });

  it('updates the buffer entry in place on a coalescing replace rather than duplicating it', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'price-pass', title: 'tick 1' }), 0);
    state = push(state, makeToast({ key: 'price-pass', title: 'tick 2' }), 1);
    expect(state.buffer.length).toBe(1);
    expect(state.buffer[0].title).toBe('tick 2');
  });
});

describe('toastQueueReducer — clear', () => {
  it('empties the live stack but leaves the notification buffer untouched', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'a' }), 0);
    state = push(state, makeToast({ key: 'b' }), 1);
    state = toastQueueReducer(state, { type: 'clear' });
    expect(state.all).toEqual([]);
    expect(state.visible).toEqual([]);
    expect(state.overflow).toEqual([]);
    expect(state.overflowCount).toBe(0);
    expect(state.buffer.length).toBe(2);
  });
});

describe('nextExpiryDeadline', () => {
  it('returns null when no live toast auto-expires', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'w', variant: 'warning' }), 0);
    expect(nextExpiryDeadline(state)).toBeNull();
  });

  it('returns the earliest deadline across mixed toasts', () => {
    let state = initialToastQueueState;
    state = push(state, makeToast({ key: 'i', variant: 'info' }), 0); // expires 4000
    state = push(state, makeToast({ key: 's', variant: 'success' }), 500); // expires 4500
    state = push(state, makeToast({ key: 'w', variant: 'warning' }), 0); // never
    expect(nextExpiryDeadline(state)).toBe(4000);
  });
});
