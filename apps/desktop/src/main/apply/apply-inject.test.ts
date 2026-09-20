import { describe, expect, it } from 'vitest';
import type { ApplyEvent, ApplyInjectRequest } from '@bombfarm/contracts';
import { createApplyInjector } from './apply-inject.js';

const UNIT_OK: ApplyEvent = { type: 'unit', runId: 'r1', step: 'equip', index: 0, status: 'ok', goldSpent: 0, walletAfter: 1_000 };
const DONE: ApplyEvent = {
  type: 'done',
  runId: 'r1',
  step: 'equip',
  result: { step: 'equip', total: 1, made: 1, skipped: [], failed: null, stop: 'finished', stopCode: null, goldSpent: 0, durationMs: 10 },
};

const SCRIPT: ApplyInjectRequest = { runId: 'r1', events: [UNIT_OK, DONE], gapMs: 250 };

describe('createApplyInjector', () => {
  it('arms a well-formed script when honoured, and take() returns it exactly once', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm(SCRIPT)).toEqual({ ok: true });
    expect(injector.take()).toEqual(SCRIPT);
    expect(injector.take()).toBeNull();
  });

  it('refuses to arm, with nothing stored, when not honoured', () => {
    const injector = createApplyInjector({ honoured: () => false });
    expect(injector.arm(SCRIPT)).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('refuses a non-object payload', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm('nope')).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('refuses a payload whose events is not an array', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm({ runId: 'r1', events: 'nope', gapMs: 0 })).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('refuses a negative gapMs', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm({ runId: 'r1', events: [], gapMs: -1 })).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('refuses a payload with no runId', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm({ events: [], gapMs: 0 })).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('refuses the whole payload when one event among otherwise-valid ones is malformed', () => {
    const injector = createApplyInjector({ honoured: () => true });
    const malformed = { runId: 'r1', events: [UNIT_OK, { type: 'unit', runId: 'r1' }, DONE], gapMs: 100 };
    expect(injector.arm(malformed)).toEqual({ ok: false });
    expect(injector.take()).toBeNull();
  });

  it('a second arm replaces the first', () => {
    const injector = createApplyInjector({ honoured: () => true });
    const first: ApplyInjectRequest = { runId: 'r1', events: [DONE], gapMs: 0 };
    const second: ApplyInjectRequest = { runId: 'r2', events: [UNIT_OK, DONE], gapMs: 500 };
    injector.arm(first);
    expect(injector.arm(second)).toEqual({ ok: true });
    expect(injector.take()).toEqual(second);
  });

  it('nothing is emitted at arm time (no emit dependency exists)', () => {
    const injector = createApplyInjector({ honoured: () => true });
    // Type-level proof: createApplyInjector's deps have no `emit` field, unlike the forge's
    // injector, so arming a script cannot itself push an event anywhere.
    expect(injector.arm(SCRIPT)).toEqual({ ok: true });
  });

  it('a well-formed script with gapMs 0 still arms', () => {
    const injector = createApplyInjector({ honoured: () => true });
    expect(injector.arm({ runId: 'r1', events: [], gapMs: 0 })).toEqual({ ok: true });
  });
});
