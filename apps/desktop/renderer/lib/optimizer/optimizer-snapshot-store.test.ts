import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TeamPlanInputs } from '@bombfarm/team-plan/core';
import {
  acceptOptimizer,
  initialOptimizerSnapshotState,
  settledSnapshot,
  snapshotSourceKey,
  type OptimizerSnapshotState,
} from './optimizer-snapshot-store';

const INPUTS = {} as TeamPlanInputs;
const CAPTURED_AT = '2026-08-12T00:00:00.000Z';
const SETTLED = { ok: true, inputs: INPUTS, capturedAt: CAPTURED_AT } as const;

function computing(sourceKey: string, farmChosenPhase: number | null = null): OptimizerSnapshotState {
  return acceptOptimizer(initialOptimizerSnapshotState, { kind: 'begin', sourceKey, farmChosenPhase });
}

function ready(sourceKey: string, farmChosenPhase: number | null = null): OptimizerSnapshotState {
  return acceptOptimizer(computing(sourceKey, farmChosenPhase), {
    kind: 'computed',
    sourceKey,
    farmChosenPhase,
    outcome: SETTLED,
  });
}

function productionSource(file: string): string {
  return readFileSync(path.join(__dirname, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('the compute-once property is structural', () => {
  const source = productionSource('optimizer-snapshot-store.ts');

  it('never subscribes to account:changed', () => {
    expect(source).not.toMatch(/account:changed/);
  });

  it('never reaches for the account seam', () => {
    expect(source).not.toMatch(/use-account-view|useAccountView/);
  });

  it('holds no AccountView at all — an account can only enter as a sourceKey string', () => {
    expect(source).not.toMatch(/AccountView/);
  });

  it('never reads the Farm view storage or localStorage — the Farm phase arrives as a value', () => {
    expect(source).not.toMatch(/farm-view-storage|localStorage/);
  });

  it('has no React import', () => {
    expect(source).not.toMatch(/from ['"]react['"]/);
  });

  it('the scan reads a real file, not an empty string', () => {
    expect(source).toMatch(/export function acceptOptimizer/);
  });
});

describe('begin — the tab opening', () => {
  it('computes when nothing is held yet', () => {
    const state = computing('key-a');
    expect(state.status).toBe('computing');
    expect(snapshotSourceKey(state)).toBe('key-a');
  });

  it('is a no-op on the snapshot already in hand — same reference, so no recompute and no re-render', () => {
    const first = ready('key-a', 10);
    const reopened = acceptOptimizer(first, { kind: 'begin', sourceKey: 'key-a', farmChosenPhase: 10 });
    expect(reopened).toBe(first);
  });

  it('adopts the account when it has changed since the last snapshot', () => {
    const state = acceptOptimizer(ready('key-a'), { kind: 'begin', sourceKey: 'key-b', farmChosenPhase: null });
    expect(state.status).toBe('computing');
    expect(snapshotSourceKey(state)).toBe('key-b');
  });

  it('re-takes the snapshot when only the Farm phase moved, the account unchanged', () => {
    const first = ready('key-a', 10);
    const state = acceptOptimizer(first, { kind: 'begin', sourceKey: 'key-a', farmChosenPhase: 20 });
    expect(state.status).toBe('computing');
    expect(state).not.toBe(first);
  });
});

describe('refresh — the player asking for the live account', () => {
  it('adopts a newer account', () => {
    const state = acceptOptimizer(ready('key-a'), { kind: 'refresh', sourceKey: 'key-b', farmChosenPhase: null });
    expect(snapshotSourceKey(state)).toBe('key-b');
    expect(state.status).toBe('computing');
  });

  it('has nothing to do when the snapshot on screen is already this account at this Farm phase', () => {
    const first = ready('key-a', 10);
    expect(acceptOptimizer(first, { kind: 'refresh', sourceKey: 'key-a', farmChosenPhase: 10 })).toBe(first);
  });

  it('recomputes when only the Farm phase moved', () => {
    const first = ready('key-a', 10);
    const state = acceptOptimizer(first, { kind: 'refresh', sourceKey: 'key-a', farmChosenPhase: 20 });
    expect(state.status).toBe('computing');
    expect(state).not.toBe(first);
  });
});

describe('controls — a pinned no-op, from every state', () => {
  it('is a no-op from idle', () => {
    expect(acceptOptimizer(initialOptimizerSnapshotState, { kind: 'controls' })).toBe(
      initialOptimizerSnapshotState,
    );
  });

  it('is a no-op from computing', () => {
    const state = computing('key-a');
    expect(acceptOptimizer(state, { kind: 'controls' })).toBe(state);
  });

  it('is a no-op from ready — the account is the snapshot input, not the controls', () => {
    const state = ready('key-a');
    expect(acceptOptimizer(state, { kind: 'controls' })).toBe(state);
  });

  it('is a no-op from unavailable', () => {
    const unavailable = acceptOptimizer(computing('key-a'), {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: null,
      outcome: { ok: false, reason: 'incomplete-account' },
    });
    expect(acceptOptimizer(unavailable, { kind: 'controls' })).toBe(unavailable);
  });
});

describe('computed — latest wins, everything else is discarded', () => {
  it('a result for an account the screen has already moved off is discarded', () => {
    const awaiting = acceptOptimizer(ready('key-a'), { kind: 'refresh', sourceKey: 'key-b', farmChosenPhase: null });
    const stale = acceptOptimizer(awaiting, {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: null,
      outcome: SETTLED,
    });
    expect(stale).toBe(awaiting);
  });

  it('a result for a Farm phase the player has already moved away from is discarded', () => {
    const awaiting = acceptOptimizer(ready('key-a', 10), { kind: 'begin', sourceKey: 'key-a', farmChosenPhase: 20 });
    const stale = acceptOptimizer(awaiting, {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: 10,
      outcome: SETTLED,
    });
    expect(stale).toBe(awaiting);
  });

  it('a result arriving when nothing is waiting for one is discarded', () => {
    const first = ready('key-a');
    const again = acceptOptimizer(first, {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: null,
      outcome: SETTLED,
    });
    expect(again).toBe(first);
  });

  it('an accepted result carries the inputs, the age of the account behind them, its source key and Farm phase', () => {
    const state = ready('key-a', 10);
    expect(state).toEqual({
      status: 'ready',
      inputs: INPUTS,
      capturedAt: CAPTURED_AT,
      sourceKey: 'key-a',
      farmChosenPhase: 10,
    });
  });

  it('an unavailable outcome names its reason and keeps the source key and Farm phase', () => {
    const state = acceptOptimizer(computing('key-a', 10), {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: 10,
      outcome: { ok: false, reason: 'incomplete-account' },
    });
    expect(state).toEqual({
      status: 'unavailable',
      reason: 'incomplete-account',
      sourceKey: 'key-a',
      farmChosenPhase: 10,
    });
  });
});

/**
 * A recompute is not a reason to blank the screen — the setup panel and scope board stay mounted
 * and busy instead (DOP-17).
 */
describe('a recompute keeps the snapshot already on screen', () => {
  it('the first compute has nothing to carry — that is the only genuine loading state', () => {
    expect(settledSnapshot(initialOptimizerSnapshotState)).toBeNull();
    expect(settledSnapshot(computing('key-a'))).toBeNull();
  });

  it('a Farm-phase-only re-take keeps the settled inputs renderable while the new ones are computed', () => {
    const recomputing = acceptOptimizer(ready('key-a', 10), { kind: 'begin', sourceKey: 'key-a', farmChosenPhase: 20 });
    expect(recomputing.status).toBe('computing');
    expect(settledSnapshot(recomputing)).toEqual({ inputs: INPUTS, capturedAt: CAPTURED_AT });
  });

  it('the carried inputs are the SAME object, not a copy', () => {
    const settled = ready('key-a');
    const recomputing = acceptOptimizer(settled, { kind: 'refresh', sourceKey: 'key-b', farmChosenPhase: null });
    expect(settledSnapshot(recomputing)?.inputs).toBe(settledSnapshot(settled)?.inputs);
  });

  it('an account judged uncomputable drops the snapshot — a named reason is not a busy screen', () => {
    const unavailable = acceptOptimizer(computing('key-a'), {
      kind: 'computed',
      sourceKey: 'key-a',
      farmChosenPhase: null,
      outcome: { ok: false, reason: 'incomplete-account' },
    });
    expect(settledSnapshot(unavailable)).toBeNull();
  });
});
