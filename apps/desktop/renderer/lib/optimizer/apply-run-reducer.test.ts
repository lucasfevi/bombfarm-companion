import { describe, expect, it } from 'vitest';
import type { ApplyEvent, ApplyRunResult } from '@bombfarm/contracts';
import { applyRunReducer, beginRun, runCounts, type ApplyRunView } from './apply-run-reducer';
import type { ApplyUnitLabel } from './apply-labels';

function unit(index: number): ApplyUnitLabel {
  return { index, call: 'equip', subject: `item ${String(index)}`, from: null, to: 'h1', points: null, gold: 0 };
}

function fourUnits(): readonly ApplyUnitLabel[] {
  return [unit(0), unit(1), unit(2), unit(3)];
}

function fold(view: ApplyRunView, events: readonly ApplyEvent[]): ApplyRunView {
  return events.reduce(applyRunReducer, view);
}

function result(overrides: Partial<ApplyRunResult> = {}): ApplyRunResult {
  return { step: 'equip', total: 4, made: 4, skipped: [], failed: null, stop: 'finished', stopCode: null, goldSpent: 0, durationMs: 0, ...overrides };
}

describe('beginRun', () => {
  it('starts every unit at "next", nothing spent, no cooldown, no result', () => {
    const run = beginRun('equip', 'r1', fourUnits(), 1_000);
    expect(run).toEqual({
      runId: 'r1',
      units: fourUnits(),
      status: ['next', 'next', 'next', 'next'],
      current: null,
      skipped: [],
      goldSpent: 0,
      walletAfter: null,
      startedAtMs: 1_000,
      cooldown: null,
      result: null,
    });
  });
});

describe('applyRunReducer — the three scripted sequences the smoke injects', () => {
  it('(a) four sent+ok pairs then done finished: every line ok, counts 4/0/0', () => {
    const events: ApplyEvent[] = [0, 1, 2, 3].flatMap((index) => [
      { type: 'unit', runId: 'r1', step: 'equip', index, status: 'sent' },
      { type: 'unit', runId: 'r1', step: 'equip', index, status: 'ok', goldSpent: 0, walletAfter: 900 },
    ]);
    const done: ApplyEvent = { type: 'done', runId: 'r1', step: 'equip', result: result() };
    const run = fold(beginRun('equip', 'r1', fourUnits(), 0), [...events, done]);
    expect(run.status).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(runCounts(run)).toMatchObject({ done: 4, skipped: 0, left: 0, total: 4 });
    expect(run.result).toEqual(result());
  });

  it('(b) three ok, one skipped with a code, a cooldown then resumed then ok, done: cooldown clears, skip carries the code, made 4 skipped 1', () => {
    const okEvents: ApplyEvent[] = [
      { type: 'unit', runId: 'r1', step: 'equip', index: 0, status: 'ok', goldSpent: 0, walletAfter: 950 },
      { type: 'unit', runId: 'r1', step: 'equip', index: 1, status: 'ok', goldSpent: 0, walletAfter: 900 },
      { type: 'unit', runId: 'r1', step: 'equip', index: 2, status: 'ok', goldSpent: 0, walletAfter: 850 },
      { type: 'unit', runId: 'r1', step: 'equip', index: 3, status: 'skipped', reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' },
    ];
    const cooldownEvent: ApplyEvent = { type: 'cooldown', runId: 'r1', step: 'equip', index: 4, resumeAtMs: 5_000 };
    const resumedEvent: ApplyEvent = { type: 'resumed', runId: 'r1', step: 'equip', index: 4 };
    const doneEvent: ApplyEvent = {
      type: 'done',
      runId: 'r1',
      step: 'equip',
      result: result({ made: 4, skipped: [{ index: 3, reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' }] }),
    };
    const run = fold(beginRun('equip', 'r1', [...fourUnits(), unit(4)], 0), okEvents);
    const afterCooldown = applyRunReducer(run, cooldownEvent);
    expect(afterCooldown.cooldown).toEqual({ index: 4, resumeAtMs: 5_000 });
    const afterResume = applyRunReducer(afterCooldown, resumedEvent);
    expect(afterResume.cooldown).toBeNull();
    const final = applyRunReducer(afterResume, doneEvent);
    expect(final.skipped).toEqual([{ index: 3, reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' }]);
    expect(final.result?.made).toBe(4);
    expect(runCounts(final)).toMatchObject({ done: 3, skipped: 1 });
  });

  it('(c) two ok then done stopped: 2 made, no third status changes', () => {
    const events: ApplyEvent[] = [
      { type: 'unit', runId: 'r1', step: 'equip', index: 0, status: 'ok', goldSpent: 0, walletAfter: 950 },
      { type: 'unit', runId: 'r1', step: 'equip', index: 1, status: 'ok', goldSpent: 0, walletAfter: 900 },
      { type: 'done', runId: 'r1', step: 'equip', result: result({ made: 2, stop: 'stopped' }) },
    ];
    const run = fold(beginRun('equip', 'r1', fourUnits(), 0), events);
    expect(run.status).toEqual(['ok', 'ok', 'next', 'next']);
    expect(run.result?.made).toBe(2);
    expect(run.result?.stop).toBe('stopped');
  });
});

describe('applyRunReducer — event edges', () => {
  it('sent sets current to the unit in flight', () => {
    const event: ApplyEvent = { type: 'unit', runId: 'r1', step: 'equip', index: 2, status: 'sent' };
    const run = applyRunReducer(beginRun('equip', 'r1', fourUnits(), 0), event);
    expect(run.current).toBe(2);
  });

  it('done before any unit event leaves made at whatever the result says (0 here)', () => {
    const started = beginRun('equip', 'r1', fourUnits(), 0);
    const event: ApplyEvent = { type: 'done', runId: 'r1', step: 'equip', result: result({ made: 0, skipped: [] }) };
    const run = applyRunReducer(started, event);
    expect(run.result?.made).toBe(0);
    expect(run.status).toEqual(['next', 'next', 'next', 'next']);
  });

  it('a foreign runId and an out-of-range index are both ignored — the same reference comes back', () => {
    const run = beginRun('equip', 'r1', fourUnits(), 0);
    const foreignRun: ApplyEvent = { type: 'unit', runId: 'other', step: 'equip', index: 0, status: 'ok' };
    const badIndex: ApplyEvent = { type: 'unit', runId: 'r1', step: 'equip', index: 99, status: 'ok' };
    const badCooldownIndex: ApplyEvent = { type: 'cooldown', runId: 'r1', step: 'equip', index: 99, resumeAtMs: 1 };
    expect(applyRunReducer(run, foreignRun)).toBe(run);
    expect(applyRunReducer(run, badIndex)).toBe(run);
    expect(applyRunReducer(run, badCooldownIndex)).toBe(run);
  });

  it('goldSpent and walletAfter follow the last event that carries them', () => {
    const events: ApplyEvent[] = [
      { type: 'unit', runId: 'r1', step: 'equip', index: 0, status: 'ok', goldSpent: 100, walletAfter: 900 },
      { type: 'unit', runId: 'r1', step: 'equip', index: 1, status: 'ok', goldSpent: 250, walletAfter: 650 },
    ];
    const run = fold(beginRun('equip', 'r1', fourUnits(), 0), events);
    expect(run.goldSpent).toBe(250);
    expect(run.walletAfter).toBe(650);
  });
});

describe('runCounts', () => {
  it('reports done, skipped, left, total and the current index', () => {
    const events: ApplyEvent[] = [
      { type: 'unit', runId: 'r1', step: 'equip', index: 0, status: 'ok' },
      { type: 'unit', runId: 'r1', step: 'equip', index: 1, status: 'skipped', reason: 'itemMissing' },
      { type: 'unit', runId: 'r1', step: 'equip', index: 2, status: 'sent' },
    ];
    const run = fold(beginRun('equip', 'r1', fourUnits(), 0), events);
    expect(runCounts(run)).toEqual({ done: 1, skipped: 1, left: 2, total: 4, current: 2 });
  });
});
