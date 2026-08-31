/**
 * The store wiring, driven directly — `apps/desktop`'s Vitest project is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect`, so the actions are what is testable and
 * the hook around them is a thin read.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { accountChangeKey } from '@bombfarm/contracts';
import type { FarmControls } from './farm-inputs';
import { createFarmSnapshotStore } from './use-farm-snapshot';

const CONTROLS: FarmControls = { farmPoolOverrides: {}, farmReturnBonus: 'off' };

function fidelityAt(capturedAt: string): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt },
    heroes: { status: 'resolved', capturedAt },
    skills: { status: 'resolved', capturedAt },
    casa: { status: 'resolved', capturedAt },
    items: { status: 'resolved', capturedAt },
  };
}

function rawHero(id: string, level: number) {
  const birth = {
    dmg: 100,
    energia: 100,
    speed: 50,
    crit_chance: 5,
    crit_dmg: 50,
    penetration: 0,
    cooldown_reduction: 0,
    luck: 0,
  };
  return { id, name: 'Alpha', level, rarity: 2, stars: 1, birth_stats: birth, stats: birth, stat_points_available: 0 };
}

function payloadAtLevel(level: number): AccountPayload {
  return {
    account: { phase: 12, max_phase: 20, gold: String(level) },
    heroes: [rawHero('h1', level)],
    skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity: fidelityAt('2026-08-12T00:00:00.000Z'),
  };
}

function viewAtLevel(level: number): { view: AccountView; key: string } {
  const payload = payloadAtLevel(level);
  return {
    view: { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } },
    key: accountChangeKey(payload),
  };
}

describe('the snapshot store computes once and does not follow the live account', () => {
  it('start() wires nothing — nothing can feed this store but its own actions', () => {
    const { store } = createFarmSnapshotStore();
    store.start();
    expect(store.getState()).toEqual({ status: 'idle' });
  });

  it('opening the screen computes a board, and opening it again on the same account does not', () => {
    const { store, open } = createFarmSnapshotStore();
    const first = viewAtLevel(10);

    open(first.view, first.key, CONTROLS);
    const afterOpen = store.getState();
    if (afterOpen.status !== 'ready') throw new Error('expected ready');
    // A real board, not an empty one with a named reason — otherwise the rest proves nothing.
    expect(afterOpen.board.reason).toBeNull();
    expect(afterOpen.board.rows.length).toBeGreaterThan(0);

    // A second mount of the screen against the same account: same state reference, so the board
    // is the one already computed, not a fresh one that happens to be equal.
    open(first.view, first.key, CONTROLS);
    expect(store.getState()).toBe(afterOpen);
  });

  it('a hundred live ticks reach the store only if something calls an action — the ticks alone move nothing', () => {
    const { store, open } = createFarmSnapshotStore();
    const opened = viewAtLevel(10);
    open(opened.view, opened.key, CONTROLS);
    const snapshot = store.getState();

    // Everything the account seam does on a tick is produce a new AccountView with a new key.
    // There is no arrival on this store that takes one, so the loop below is what a screen that
    // ignores the ticks looks like: the state is untouched, by construction.
    for (let level = 11; level <= 110; level++) {
      const tick = viewAtLevel(level);
      expect(tick.key).not.toBe(opened.key);
    }
    expect(store.getState()).toBe(snapshot);
  });

  it('an explicit refresh adopts the account the ticks moved to', () => {
    const { store, open, refresh } = createFarmSnapshotStore();
    const first = viewAtLevel(10);
    const later = viewAtLevel(80);

    open(first.view, first.key, CONTROLS);
    const beforeRefresh = store.getState();
    refresh(later.view, later.key, CONTROLS);
    const afterRefresh = store.getState();

    expect(afterRefresh).not.toBe(beforeRefresh);
    expect(afterRefresh.status).toBe('ready');
    if (afterRefresh.status !== 'ready') throw new Error('expected ready');
    expect(afterRefresh.sourceKey).toBe(later.key);
  });

  it('changing a compute input recomputes against the frozen account, not the live one', () => {
    const { store, open, setControls } = createFarmSnapshotStore();
    const opened = viewAtLevel(10);
    open(opened.view, opened.key, CONTROLS);

    setControls({ farmPoolOverrides: {}, farmReturnBonus: 'vip' });
    const state = store.getState();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.sourceKey).toBe(opened.key);
    expect(state.inputs.farmReturnBonus).toBe('vip');
    expect(state.inputs.heroes[0]?.level).toBe(10);
  });

  it('setControls before the screen ever opened does nothing — there is no frozen account yet', () => {
    const { store, setControls } = createFarmSnapshotStore();
    setControls({ farmPoolOverrides: {}, farmReturnBonus: 'vip' });
    expect(store.getState()).toEqual({ status: 'idle' });
  });

  it('an account the board may not be computed from becomes a named unavailable state', () => {
    const { store, open } = createFarmSnapshotStore();
    const payload: AccountPayload = {
      ...payloadAtLevel(10),
      fidelity: { ...fidelityAt('2026-08-12T00:00:00.000Z'), skills: { status: 'missing' } },
    };
    const view: AccountView = {
      payload,
      gameRunning: false,
      store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
    };

    open(view, accountChangeKey(payload), CONTROLS);
    expect(store.getState()).toEqual({
      status: 'unavailable',
      reason: 'incomplete-account',
      sourceKey: accountChangeKey(payload),
    });
  });

  it('each store owns its own memo, so one test run cannot inherit another store warm cache', () => {
    const a = createFarmSnapshotStore();
    const b = createFarmSnapshotStore();
    const opened = viewAtLevel(10);
    a.open(opened.view, opened.key, CONTROLS);
    b.open(opened.view, opened.key, CONTROLS);

    const stateA = a.store.getState();
    const stateB = b.store.getState();
    if (stateA.status !== 'ready' || stateB.status !== 'ready') throw new Error('expected ready');
    expect(stateA.board).not.toBe(stateB.board);
  });
});

describe('the hook subscribes to the account seam for freshness only', () => {
  const source = readFileSync(path.join(__dirname, 'use-farm-snapshot.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function useFarmSnapshot/);
  });

  it('opens no subscription of its own — no bridge event reaches this seam', () => {
    expect(source).not.toMatch(/account:changed/);
    expect(source).not.toMatch(/\.on\(/);
    expect(source).not.toMatch(/setInterval|setTimeout/);
  });

  it('never dispatches from an effect that depends on the account view', () => {
    // The one `useEffect` here takes an empty dependency array: it subscribes to the snapshot
    // store and nothing else. An effect keyed on the account view is exactly how a recompute
    // per live tick would get reintroduced.
    const effects = source.match(/useEffect\(/g) ?? [];
    expect(effects).toHaveLength(1);
    expect(source).toMatch(/\}, \[\]\);/);
  });
});
