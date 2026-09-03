import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FarmInputs, FarmRankingResult, FarmRespecGate } from '@bombfarm/farm/core';
import type { FarmControls } from './farm-inputs';
import {
  accept,
  initialFarmSnapshotState,
  settledBoard,
  snapshotSourceKey,
  type FarmSnapshotArrival,
  type FarmSnapshotState,
} from './farm-snapshot-store';

const CONTROLS: FarmControls = { farmPoolOverrides: {}, farmReturnBonus: 'off' };
const OTHER_CONTROLS: FarmControls = { farmPoolOverrides: {}, farmReturnBonus: 'vip' };

const BOARD = { rows: [], reason: null } as FarmRankingResult;
const INPUTS = {} as FarmInputs;
const GATE: FarmRespecGate = { result: null, reason: 'no-roster', shouldSurface: false };
const CAPTURED_AT = '2026-08-12T00:00:00.000Z';
const SETTLED = { ok: true, board: BOARD, inputs: INPUTS, gate: GATE, capturedAt: CAPTURED_AT } as const;

function computing(sourceKey: string, controls: FarmControls = CONTROLS): FarmSnapshotState {
  return accept(initialFarmSnapshotState, { kind: 'begin', sourceKey, controls });
}

function ready(sourceKey: string, controls: FarmControls = CONTROLS): FarmSnapshotState {
  return accept(computing(sourceKey, controls), {
    kind: 'computed',
    sourceKey,
    controls,
    outcome: SETTLED,
  });
}

/** Doc comments legitimately explain WHY these names never appear here; that is text about the
 *  rule, not a violation of it. Same dumb text slicing the repo's other identifier scans use. */
function productionSource(file: string): string {
  return readFileSync(path.join(__dirname, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('the compute-once property is structural', () => {
  const source = productionSource('farm-snapshot-store.ts');

  it('never subscribes to account:changed', () => {
    expect(source).not.toMatch(/account:changed/);
  });

  it('never reaches for the account seam', () => {
    expect(source).not.toMatch(/use-account-view|useAccountView/);
  });

  it('holds no AccountView at all — an account can only enter as a sourceKey string', () => {
    expect(source).not.toMatch(/AccountView/);
  });

  it('has no React import', () => {
    expect(source).not.toMatch(/from ['"]react['"]/);
  });

  it('the scan reads a real file, not an empty string', () => {
    expect(source).toMatch(/export function accept/);
  });
});

describe('begin — the screen opening', () => {
  it('computes when nothing is held yet', () => {
    const state = computing('key-a');
    expect(state.status).toBe('computing');
    expect(snapshotSourceKey(state)).toBe('key-a');
  });

  it('is a no-op on the snapshot already in hand — same reference, so no recompute and no re-render', () => {
    const first = ready('key-a');
    const reopened = accept(first, { kind: 'begin', sourceKey: 'key-a', controls: OTHER_CONTROLS });
    expect(reopened).toBe(first);
  });

  it('adopts the account when it has changed since the last snapshot', () => {
    const state = accept(ready('key-a'), { kind: 'begin', sourceKey: 'key-b', controls: CONTROLS });
    expect(state.status).toBe('computing');
    expect(snapshotSourceKey(state)).toBe('key-b');
  });
});

describe('refresh — the player asking for the live account', () => {
  it('adopts a newer account', () => {
    const state = accept(ready('key-a'), { kind: 'refresh', sourceKey: 'key-b', controls: CONTROLS });
    expect(snapshotSourceKey(state)).toBe('key-b');
    expect(state.status).toBe('computing');
  });

  it('has nothing to do when the board on screen is already this account at these controls', () => {
    const first = ready('key-a');
    expect(accept(first, { kind: 'refresh', sourceKey: 'key-a', controls: CONTROLS })).toBe(first);
  });
});

describe('controls — a compute input changing', () => {
  it('recomputes against the SAME frozen account, never a newer one', () => {
    const state = accept(ready('key-a'), { kind: 'controls', controls: OTHER_CONTROLS });
    expect(state.status).toBe('computing');
    expect(snapshotSourceKey(state)).toBe('key-a');
  });

  it('is a no-op when the controls did not actually move', () => {
    const first = ready('key-a');
    expect(accept(first, { kind: 'controls', controls: CONTROLS })).toBe(first);
  });

  it('is ignored from idle — there is no frozen account to recompute against', () => {
    expect(accept(initialFarmSnapshotState, { kind: 'controls', controls: CONTROLS })).toBe(
      initialFarmSnapshotState,
    );
  });

  it('is ignored when the account was already judged uncomputable — no control changes that', () => {
    const unavailable = accept(computing('key-a'), {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: { ok: false, reason: 'incomplete-account' },
    });
    expect(accept(unavailable, { kind: 'controls', controls: OTHER_CONTROLS })).toBe(unavailable);
  });
});

describe('computed — latest wins, everything else is discarded', () => {
  it('a result for an account the screen has already moved off is discarded', () => {
    const awaiting = accept(ready('key-a'), { kind: 'refresh', sourceKey: 'key-b', controls: CONTROLS });
    const stale = accept(awaiting, {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: SETTLED,
    });
    expect(stale).toBe(awaiting);
  });

  it('a result for controls the player has already changed away from is discarded', () => {
    const awaiting = accept(ready('key-a'), { kind: 'controls', controls: OTHER_CONTROLS });
    const stale = accept(awaiting, {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: SETTLED,
    });
    expect(stale).toBe(awaiting);
  });

  it('a result arriving when nothing is waiting for one is discarded', () => {
    const first = ready('key-a');
    const again = accept(first, {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: SETTLED,
    });
    expect(again).toBe(first);
  });

  it('an accepted result carries the board, the inputs it was computed from, its gate, the age of the account behind it and its source', () => {
    const state = ready('key-a');
    expect(state).toEqual({
      status: 'ready',
      board: BOARD,
      inputs: INPUTS,
      gate: GATE,
      capturedAt: CAPTURED_AT,
      controls: CONTROLS,
      sourceKey: 'key-a',
    });
  });

  it('demonstrates the red state: dropping the sourceKey check lets a stale board overwrite a newer snapshot', () => {
    function acceptWithoutSourceCheck(state: FarmSnapshotState, arrival: FarmSnapshotArrival): FarmSnapshotState {
      if (arrival.kind !== 'computed' || !arrival.outcome.ok) return accept(state, arrival);
      return {
        status: 'ready',
        board: arrival.outcome.board,
        inputs: arrival.outcome.inputs,
        gate: arrival.outcome.gate,
        capturedAt: arrival.outcome.capturedAt,
        controls: arrival.controls,
        sourceKey: arrival.sourceKey,
      };
    }

    const awaiting = acceptWithoutSourceCheck(ready('key-a'), {
      kind: 'refresh',
      sourceKey: 'key-b',
      controls: CONTROLS,
    });
    const overwritten = acceptWithoutSourceCheck(awaiting, {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: SETTLED,
    });

    // The mutant pins the board to the account the screen has already left. The real reducer
    // asserts the opposite above (`stale` toBe `awaiting`).
    expect(snapshotSourceKey(awaiting)).toBe('key-b');
    expect(snapshotSourceKey(overwritten)).toBe('key-a');
  });
});

/**
 * A recompute is not a reason to blank the screen. The board's filters and column sort live in
 * the component that draws it, so unmounting it for one frame silently resets both — which is
 * what toggling a single hero in the rotation pool used to do.
 */
describe('a recompute keeps the board that is already on screen', () => {
  it('the first compute has nothing to carry — that is the only genuine loading state', () => {
    expect(settledBoard(initialFarmSnapshotState)).toBeNull();
    expect(settledBoard(computing('key-a'))).toBeNull();
  });

  it('a controls change keeps the settled board renderable while the new one is computed', () => {
    const recomputing = accept(ready('key-a'), { kind: 'controls', controls: OTHER_CONTROLS });
    expect(recomputing.status).toBe('computing');
    expect(settledBoard(recomputing)).toEqual({
      board: BOARD,
      inputs: INPUTS,
      gate: GATE,
      capturedAt: CAPTURED_AT,
    });
  });

  it('the carried board is the SAME rows object, not a copy — the table is not re-keyed', () => {
    const settled = ready('key-a');
    const recomputing = accept(settled, { kind: 'controls', controls: OTHER_CONTROLS });
    expect(settledBoard(recomputing)?.board).toBe(settledBoard(settled)?.board);
  });

  it('a refresh and a re-open onto a moved account carry it forward too', () => {
    const refreshing = accept(ready('key-a'), {
      kind: 'refresh',
      sourceKey: 'key-b',
      controls: CONTROLS,
    });
    const reopening = accept(ready('key-a'), {
      kind: 'begin',
      sourceKey: 'key-b',
      controls: CONTROLS,
    });
    expect(settledBoard(refreshing)?.board).toBe(BOARD);
    expect(settledBoard(reopening)?.board).toBe(BOARD);
  });

  it('two recomputes in a row still carry the last settled board, never the previous computing state', () => {
    const once = accept(ready('key-a'), { kind: 'controls', controls: OTHER_CONTROLS });
    const twice = accept(once, { kind: 'controls', controls: CONTROLS });
    expect(settledBoard(twice)?.board).toBe(BOARD);
  });

  it('an account judged uncomputable drops the board — a named reason is not a busy board', () => {
    const unavailable = accept(computing('key-a'), {
      kind: 'computed',
      sourceKey: 'key-a',
      controls: CONTROLS,
      outcome: { ok: false, reason: 'incomplete-account' },
    });
    expect(settledBoard(unavailable)).toBeNull();
  });
});
