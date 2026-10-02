import { describe, expect, it, vi } from 'vitest';
import type { CollectionsView } from '@bombfarm/contracts';
import { collectionsWireKey } from '@bombfarm/game-api';
import { createLogSpy } from '../storage/test-support.js';
import { createCollectionsRecorder } from './collections-recorder.js';
import { createCollectionsStore } from './collections-store.js';
import { collectionsBody, collectionsSnapshot, openDb } from './collections-test-support.js';

function setup() {
  const store = createCollectionsStore({ db: openDb(), accountId: () => '486' });
  const emitted: CollectionsView[] = [];
  const { log, records } = createLogSpy();
  const recorder = createCollectionsRecorder({ store, emit: (view) => emitted.push(view), log });
  return { store, emitted, records, recorder };
}

describe('collections recorder', () => {
  it('keeps the body it is handed and announces the view, dated by when the body passed', () => {
    const { store, emitted, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    const expected = { snapshot: collectionsSnapshot(), capturedAt: new Date(1_000).toISOString() };
    expect(store.view()).toEqual(expected);
    expect(emitted).toEqual([expected]);
  });

  it('re-dates and announces a body that repeats the held one, because it is still a read', () => {
    const { store, emitted, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    recorder.observe({ body: collectionsBody(), atMs: 2_000 });
    expect(store.view().capturedAt).toBe(new Date(2_000).toISOString());
    expect(emitted).toHaveLength(2);
    expect(emitted[1]?.snapshot).toEqual(emitted[0]?.snapshot);
  });

  it('replaces the held snapshot when the progress moved', () => {
    const { store, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    const moved = collectionsBody();
    moved[collectionsWireKey('partialPct')] = 70;
    recorder.observe({ body: moved, atMs: 2_000 });
    expect(store.view().snapshot?.partialPct).toBe(70);
  });

  it('keeps a body that carries a key the game added, and logs the drift once', () => {
    const { store, emitted, records, recorder } = setup();
    const drifted = collectionsBody();
    drifted['added_by_a_later_patch'] = 1;
    recorder.observe({ body: drifted, atMs: 1_000 });
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
    expect(emitted).toHaveLength(1);
    expect(records.filter((entry) => entry.level === 'warn').map((entry) => entry.record['event'])).toEqual(['read.drift']);
  });

  it('logs nothing at warn level for a body of the exact shape', () => {
    const { records, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    expect(records.filter((entry) => entry.level === 'warn')).toEqual([]);
  });

  it('stores nothing and warns for a body it cannot read', () => {
    const { store, emitted, records, recorder } = setup();
    const broken = collectionsBody();
    Reflect.deleteProperty(broken, collectionsWireKey('sets'));
    recorder.observe({ body: broken, atMs: 1_000 });
    recorder.observe({ body: 'not a body', atMs: 2_000 });
    expect(store.view().snapshot).toBeNull();
    expect(emitted).toEqual([]);
    expect(records.filter((entry) => entry.level === 'warn').map((entry) => entry.record['event'])).toEqual([
      'read.unreadable',
      'read.unreadable',
    ]);
  });

  it('keeps the last good snapshot when a later body cannot be read', () => {
    const { store, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    recorder.observe({ body: { versao: 5 }, atMs: 2_000 });
    expect(store.view()).toEqual({ snapshot: collectionsSnapshot(), capturedAt: new Date(1_000).toISOString() });
  });

  it('announces nothing when the store could not write', () => {
    const emit = vi.fn();
    const store = createCollectionsStore({ db: null, accountId: () => '486' });
    createCollectionsRecorder({ store, emit }).observe({ body: collectionsBody(), atMs: 1_000 });
    expect(emit).not.toHaveBeenCalled();
  });
});
