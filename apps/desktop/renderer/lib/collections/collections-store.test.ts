import { describe, expect, it, vi } from 'vitest';
import { EMPTY_COLLECTIONS_VIEW, type CollectionsView } from '@bombfarm/contracts';
import { accept, initialCollectionsState } from './collections-store';
import { collectionsSnapshotFixture } from './collections-test-fixture';
import { createCollectionsStore } from './use-collections';

type Bridge = NonNullable<Window['bfc']>;

function view(capturedAt: string): CollectionsView {
  return { snapshot: collectionsSnapshotFixture(), capturedAt };
}

describe('collections store', () => {
  it('starts loading with nothing read', () => {
    expect(initialCollectionsState.status).toBe('loading');
    expect(initialCollectionsState.view).toBe(EMPTY_COLLECTIONS_VIEW);
  });

  it('reports an unavailable bridge instead of throwing', () => {
    const state = accept(initialCollectionsState, { kind: 'bridge-missing' });
    expect(state.status).toBe('bridge-unavailable');
    expect(accept(state, { kind: 'bridge-missing' })).toBe(state);
  });

  it('applies the mount read', () => {
    const state = accept(initialCollectionsState, { kind: 'fetched', view: view('2026-10-02T10:00:00.000Z'), issuedAt: 0 });
    expect(state.status).toBe('ready');
    expect(state.view.capturedAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('discards a mount read that a push overtook while it was in flight', () => {
    const pushed = accept(initialCollectionsState, { kind: 'pushed', view: view('2026-10-02T10:05:00.000Z') });
    expect(accept(pushed, { kind: 'fetched', view: view('2026-10-02T10:00:00.000Z'), issuedAt: 0 })).toBe(pushed);
  });

  it('counts a push that repeats the held snapshot as news, since its date moved', () => {
    const first = accept(initialCollectionsState, { kind: 'pushed', view: view('2026-10-02T10:00:00.000Z') });
    const second = accept(first, { kind: 'pushed', view: view('2026-10-02T10:01:00.000Z') });
    expect(second).not.toBe(first);
    expect(second.applied).toBe(first.applied + 1);
    expect(second.view.capturedAt).toBe('2026-10-02T10:01:00.000Z');
  });

  it('never blanks a screen already drawn when a later read fails', () => {
    const pushed = accept(initialCollectionsState, { kind: 'pushed', view: view('2026-10-02T10:00:00.000Z') });
    expect(accept(pushed, { kind: 'fetch-failed', issuedAt: 1 })).toBe(pushed);
    expect(accept(initialCollectionsState, { kind: 'fetch-failed', issuedAt: 0 }).status).toBe('unavailable');
  });

  it('is ready with an empty view when main has read nothing yet', () => {
    const state = accept(initialCollectionsState, { kind: 'fetched', view: EMPTY_COLLECTIONS_VIEW, issuedAt: 0 });
    expect(state.status).toBe('ready');
    expect(state.view.snapshot).toBeNull();
  });
});

describe('createCollectionsStore', () => {
  it('reads the view once on start and folds every push after it', async () => {
    const handlers: ((pushed: CollectionsView) => void)[] = [];
    const invoke = vi.fn(() => Promise.resolve(EMPTY_COLLECTIONS_VIEW));
    const on = vi.fn((_channel: string, handler: (pushed: CollectionsView) => void) => {
      handlers.push(handler);
      return () => undefined;
    });
    const bridge = { invoke, on } as unknown as Bridge;

    const store = createCollectionsStore(() => bridge);
    store.start();
    store.start();
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('collections:get');
    expect(on).toHaveBeenCalledWith('collections:changed', expect.any(Function));
    expect(store.getState().status).toBe('ready');

    const seen: (string | null)[] = [];
    store.subscribe((state) => seen.push(state.view.capturedAt));
    handlers[0]?.(view('2026-10-02T10:00:00.000Z'));
    expect(seen).toEqual(['2026-10-02T10:00:00.000Z']);
  });

  it('settles to bridge-unavailable with no bridge, without invoking anything', () => {
    const store = createCollectionsStore(() => null);
    store.start();
    expect(store.getState().status).toBe('bridge-unavailable');
  });
});
