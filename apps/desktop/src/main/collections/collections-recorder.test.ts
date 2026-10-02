import { describe, expect, it, vi } from 'vitest';
import type { CollectionsView } from '@bombfarm/contracts';
import { collectionsWireKey } from '@bombfarm/game-api';
import { createLogSpy } from '../storage/test-support.js';
import { createCollectionsRecorder } from './collections-recorder.js';
import { createCollectionsStore } from './collections-store.js';
import { collectionsBody, collectionsSnapshot, openDb } from './collections-test-support.js';

function setup(account: { current: string | null } = { current: '486' }) {
  const store = createCollectionsStore({ db: openDb(), accountId: () => account.current, accountSource: () => 'server' });
  const emitted: CollectionsView[] = [];
  const { log, records } = createLogSpy();
  const recorder = createCollectionsRecorder({ store, emit: (view) => emitted.push(view), log });
  return { store, emitted, records, recorder, account };
}

function warnEvents(records: ReturnType<typeof createLogSpy>['records']): unknown[] {
  return records.filter((entry) => entry.level === 'warn').map((entry) => entry.record['event']);
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

  it('stores a read under the account it was asked as, and announces nothing, when the bound account changed meanwhile', () => {
    const { store, emitted, account, recorder } = setup({ current: '486' });
    account.current = '11882';

    recorder.observe({ body: collectionsBody(), atMs: 1_000, accountId: '486' });

    expect(emitted).toEqual([]);
    expect(store.view().snapshot).toBeNull();
    account.current = '486';
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
  });

  it('announces a read for the account that is still bound', () => {
    const { emitted, recorder } = setup({ current: '486' });
    recorder.observe({ body: collectionsBody(), atMs: 1_000, accountId: '486' });
    expect(emitted).toHaveLength(1);
  });

  it('stores a body the tap saw under whichever account is bound as it passes', () => {
    const { store, account, recorder } = setup({ current: '11882' });
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
    account.current = '486';
    expect(store.view().snapshot).toBeNull();
  });

  it('keeps a body that carries a key the game added, and logs the drift once', () => {
    const { store, emitted, records, recorder } = setup();
    const drifted = collectionsBody();
    drifted['added_by_a_later_patch'] = 1;
    recorder.observe({ body: drifted, atMs: 1_000 });
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
    expect(emitted).toHaveLength(1);
    expect(warnEvents(records)).toEqual(['read.drift']);
  });

  it('logs the drift when the strict identifier passes but an effect on an unknown axis was dropped', () => {
    const { store, records, recorder } = setup();
    const body = collectionsBody();
    const sets = body[collectionsWireKey('sets')] as Record<string, unknown>[];
    const firstEffects = sets[0]?.[collectionsWireKey('setEffects')] as Record<string, unknown>[];
    firstEffects.push({ ...firstEffects[0], [collectionsWireKey('effectAxis')]: 'sabor' });
    recorder.observe({ body, atMs: 1_000 });
    expect(store.view().snapshot).toEqual(collectionsSnapshot());
    expect(warnEvents(records)).toEqual(['read.drift']);
  });

  it('logs nothing at warn level for a body of the exact shape', () => {
    const { records, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    expect(warnEvents(records)).toEqual([]);
  });

  it('stores nothing and warns for a body it cannot read', () => {
    const { store, emitted, records, recorder } = setup();
    const broken = collectionsBody();
    Reflect.deleteProperty(broken, collectionsWireKey('sets'));
    recorder.observe({ body: broken, atMs: 1_000 });
    recorder.observe({ body: 'not a body', atMs: 2_000 });
    expect(store.view().snapshot).toBeNull();
    expect(emitted).toEqual([]);
    expect(warnEvents(records)).toEqual(['read.unreadable', 'read.unreadable']);
  });

  it('keeps the last good snapshot when a later body cannot be read', () => {
    const { store, recorder } = setup();
    recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    recorder.observe({ body: { versao: 5 }, atMs: 2_000 });
    expect(store.view()).toEqual({ snapshot: collectionsSnapshot(), capturedAt: new Date(1_000).toISOString() });
  });

  it('announces nothing when the store could not write', () => {
    const emit = vi.fn();
    const store = createCollectionsStore({ db: null, accountId: () => '486', accountSource: () => 'server' });
    createCollectionsRecorder({ store, emit }).observe({ body: collectionsBody(), atMs: 1_000 });
    expect(emit).not.toHaveBeenCalled();
  });

  it('neither throws nor announces when the database has been closed', () => {
    const db = openDb();
    const emit = vi.fn();
    const store = createCollectionsStore({ db, accountId: () => '486', accountSource: () => 'server' });
    const recorder = createCollectionsRecorder({ store, emit });
    db.close();
    expect(() => {
      recorder.observe({ body: collectionsBody(), atMs: 1_000 });
    }).not.toThrow();
    expect(emit).not.toHaveBeenCalled();
  });
});
