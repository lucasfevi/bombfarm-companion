import { describe, expect, it } from 'vitest';
import type { ForgeEvent } from '@bombfarm/contracts';
import { createForgeInjector, shouldHonourForgeInject } from './forge-inject.js';

const STEP: ForgeEvent = {
  type: 'step',
  runId: 'r1',
  itemId: 'g1',
  attempt: 1,
  kind: 'roll',
  target: 9,
  from: 8,
  to: 9,
  outcome: 'success',
  cost: 100,
  spent: 100,
  wallet: null,
};

const PAUSE: ForgeEvent = { type: 'pause', runId: 'r1', ms: 9_000 };

const DONE: ForgeEvent = {
  type: 'done',
  runId: 'r1',
  result: {
    itemId: 'g1',
    from: 8,
    to: 9,
    target: 9,
    stop: 'target',
    reached: true,
    rolls: 1,
    fails: 0,
    crits: 0,
    safeJumps: 0,
    spent: 100,
    walletAfter: null,
    durationMs: 10,
  },
};

describe('shouldHonourForgeInject', () => {
  it('is the fixture reader\'s own condition: unpackaged and BFC_GAME_READER=fixture', () => {
    expect(shouldHonourForgeInject({ BFC_GAME_READER: 'fixture' }, false)).toBe(true);
    expect(shouldHonourForgeInject({ BFC_GAME_READER: 'fixture' }, true)).toBe(false);
    expect(shouldHonourForgeInject({ BFC_GAME_READER: 'live' }, false)).toBe(false);
    expect(shouldHonourForgeInject({}, false)).toBe(false);
  });
});

describe('createForgeInjector', () => {
  it('emits every scripted event in order through the seam it was given, when honoured', () => {
    const emitted: ForgeEvent[] = [];
    const injector = createForgeInjector({ honoured: () => true, emit: (event) => emitted.push(event) });
    expect(injector.inject([STEP, PAUSE, DONE])).toEqual({ ok: true });
    expect(emitted).toEqual([STEP, PAUSE, DONE]);
  });

  it('answers { ok: false } and emits nothing in any other mode', () => {
    const emitted: ForgeEvent[] = [];
    const injector = createForgeInjector({ honoured: () => false, emit: (event) => emitted.push(event) });
    expect(injector.inject([STEP, DONE])).toEqual({ ok: false });
    expect(emitted).toEqual([]);
  });

  it('refuses a script that is not a list of forge events, even when honoured', () => {
    const emitted: ForgeEvent[] = [];
    const injector = createForgeInjector({ honoured: () => true, emit: (event) => emitted.push(event) });
    expect(injector.inject('nope')).toEqual({ ok: false });
    expect(injector.inject([{ type: 'step' }])).toEqual({ ok: false });
    expect(injector.inject([{ type: 'pause', runId: 'r1' }])).toEqual({ ok: false });
    expect(injector.inject([{ type: 'pause', runId: 'r1', ms: 'soon' }])).toEqual({ ok: false });
    expect(injector.inject([STEP, { type: 'other', runId: 'r1' }])).toEqual({ ok: false });
    expect(emitted).toEqual([]);
  });
});
