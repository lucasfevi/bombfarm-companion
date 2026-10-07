import { describe, expect, it } from 'vitest';
import type { DeconstructEvent } from '@bombfarm/contracts';
import { createDeconstructInjector } from './deconstruct-inject.js';

const BURNED: DeconstructEvent = {
  type: 'done',
  runId: 'r1',
  itemIds: ['90017', '90018'],
  result: { status: 'burned', burned: 2, gained: 90, essence: 102_570 },
};

const REFUSED: DeconstructEvent = {
  type: 'done',
  runId: 'r2',
  itemIds: ['90019'],
  result: { status: 'refused', code: 'ITEM_LOCKED' },
};

function injector(honoured: boolean) {
  const emitted: DeconstructEvent[] = [];
  return { emitted, injector: createDeconstructInjector({ honoured: () => honoured, emit: (event) => emitted.push(event) }) };
}

describe('createDeconstructInjector', () => {
  it('emits every scripted event in order through the seam it was given, when honoured', () => {
    const { emitted, injector: inject } = injector(true);
    expect(inject.inject({ events: [BURNED, REFUSED] })).toEqual({ ok: true });
    expect(emitted).toEqual([BURNED, REFUSED]);
  });

  it('answers { ok: false } and emits nothing in any other mode', () => {
    const { emitted, injector: inject } = injector(false);
    expect(inject.inject({ events: [BURNED] })).toEqual({ ok: false });
    expect(emitted).toEqual([]);
  });

  it('refuses a script that is not a list of deconstruct events, even when honoured, and emits none of it', () => {
    const { emitted, injector: inject } = injector(true);
    const bad: unknown[] = [
      'nope',
      null,
      [BURNED],
      {},
      { events: 'nope' },
      { events: [{ type: 'done' }] },
      { events: [BURNED, { ...REFUSED, runId: '' }] },
      { events: [BURNED, { ...REFUSED, itemIds: [] }] },
      { events: [BURNED, { ...REFUSED, result: { status: 'refused', code: '' } }] },
      { events: [BURNED, { ...BURNED, result: { status: 'burned', burned: -1, gained: 0, essence: 0 } }] },
      { events: [BURNED, { type: 'step', runId: 'r1' }] },
    ];
    for (const payload of bad) expect(inject.inject(payload), JSON.stringify(payload)).toEqual({ ok: false });
    expect(emitted).toEqual([]);
  });
});
