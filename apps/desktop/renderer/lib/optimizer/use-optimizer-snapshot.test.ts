/**
 * The store wiring, driven directly — `apps/desktop`'s Vitest project is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect`, so the actions are what is testable and
 * the hook around them is a thin read.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTeamPlanInput, DEFAULT_TEAM_PLAN_CONTROLS } from '@bombfarm/team-plan/core';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { accountChangeKey } from '@bombfarm/contracts';
import { buildOptimizerInputs } from './optimizer-inputs';
import { createOptimizerStore, optimizerSnapshotStale } from './use-optimizer-snapshot';

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
    account: { phase: 12, max_phase: 20, gold: '1' },
    heroes: [rawHero('h1', level)],
    skills: { totals: { dmg_static: 1.5 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity: fidelityAt('2026-08-12T00:00:00.000Z'),
  };
}

function viewOf(payload: AccountPayload): { view: AccountView; key: string } {
  return {
    view: { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } },
    key: accountChangeKey(payload),
  };
}

function viewAtLevel(level: number): { view: AccountView; key: string } {
  return viewOf(payloadAtLevel(level));
}

function payloadWithGold(level: number, gold: string): AccountPayload {
  const payload = payloadAtLevel(level);
  return { ...payload, account: { ...payload.account, gold } };
}

function payloadWithBlockedSecondHero(level: number): AccountPayload {
  const payload = payloadAtLevel(level);
  const blocked = rawHero('h2', level);
  delete (blocked as Record<string, unknown>).stats;
  return { ...payload, heroes: [...(payload.heroes as unknown[]), blocked] };
}

describe('the snapshot store computes once and does not follow the live account', () => {
  it('start() wires nothing — nothing can feed this store but its own actions', () => {
    const { store } = createOptimizerStore();
    store.start();
    expect(store.getState()).toEqual({ status: 'idle' });
  });

  it('opening the tab builds the inputs, and opening it again on the same account and Farm phase does not', () => {
    const { store, open } = createOptimizerStore();
    const first = viewAtLevel(10);

    open(first.view, first.key, null);
    const afterOpen = store.getState();
    if (afterOpen.status !== 'ready') throw new Error('expected ready');
    expect(afterOpen.inputs.heroes).toHaveLength(1);

    open(first.view, first.key, null);
    expect(store.getState()).toBe(afterOpen);
  });

  it('opening again after a gold-only tick keeps the snapshot in hand, even though the account key moved', () => {
    const { store, open } = createOptimizerStore();
    const first = viewAtLevel(10);
    open(first.view, first.key, null);
    const afterOpen = store.getState();

    const ticked = viewOf(payloadWithGold(10, '999'));
    expect(ticked.key).not.toBe(first.key);
    open(ticked.view, ticked.key, null);

    expect(store.getState()).toBe(afterOpen);
  });

  it('opening again after a hero levelled up re-takes the snapshot', () => {
    const { store, open } = createOptimizerStore();
    const first = viewAtLevel(10);
    open(first.view, first.key, null);
    const afterOpen = store.getState();

    const levelled = viewAtLevel(11);
    open(levelled.view, levelled.key, null);
    const afterReopen = store.getState();

    expect(afterReopen).not.toBe(afterOpen);
    if (afterReopen.status !== 'ready') throw new Error('expected ready');
    expect(afterReopen.sourceKey).toBe(levelled.key);
    expect(afterReopen.inputs.heroes[0]?.level).toBe(11);
  });

  it('opening with the same account but a different Farm phase recomputes', () => {
    const { store, open } = createOptimizerStore();
    const first = viewAtLevel(10);

    open(first.view, first.key, null);
    const afterFirstOpen = store.getState();
    open(first.view, first.key, 42);
    const afterSecondOpen = store.getState();

    expect(afterSecondOpen).not.toBe(afterFirstOpen);
    if (afterSecondOpen.status !== 'ready') throw new Error('expected ready');
    expect(afterSecondOpen.farmChosenPhase).toBe(42);
    expect(afterSecondOpen.inputs.farmChosenPhase).toBe(42);
  });

  it('a hundred live ticks reach the store only if something calls an action', () => {
    const { store, open } = createOptimizerStore();
    const opened = viewAtLevel(10);
    open(opened.view, opened.key, null);
    const snapshot = store.getState();

    for (let level = 11; level <= 110; level++) {
      const tick = viewAtLevel(level);
      expect(tick.key).not.toBe(opened.key);
    }
    expect(store.getState()).toBe(snapshot);
  });

  it('carries leftOut on the settled snapshot, named for a hero the account read could not read the points of', () => {
    const { store, open } = createOptimizerStore();
    const { view, key } = viewOf(payloadWithBlockedSecondHero(10));

    open(view, key, null);
    const state = store.getState();
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.leftOut).toEqual([{ id: 'h2', name: 'Alpha' }]);
    expect(state.inputs.heroes.some((hero) => hero.id === 'h2')).toBe(false);
  });

  it('an explicit refresh adopts the account the ticks moved to, and leaves any plan alone', () => {
    const { store, planStore, open, refresh, startRun, applyPlan } = createOptimizerStore();
    const first = viewAtLevel(10);
    const later = viewAtLevel(80);

    open(first.view, first.key, null);
    startRun('r1', 'sig-1', []);
    applyPlan('r1', { gain: 1 } as never);
    const planBeforeRefresh = planStore.getState();

    refresh(later.view, later.key, null);
    const afterRefresh = store.getState();

    expect(afterRefresh.status).toBe('ready');
    if (afterRefresh.status !== 'ready') throw new Error('expected ready');
    expect(afterRefresh.sourceKey).toBe(later.key);
    expect(planStore.getState()).toBe(planBeforeRefresh);
  });
});

describe('the lifecycle actions reach the plan store', () => {
  it('startRun, resolveRun, applyPlan, openHeroes and clearPlan each dispatch into it', () => {
    const { planStore, startRun, resolveRun, applyPlan, openHeroes, clearPlan } = createOptimizerStore();

    startRun('r1', 'sig-1', []);
    expect(planStore.getState()).toMatchObject({ runStatus: 'running', runId: 'r1', signature: 'sig-1', heroes: [] });

    resolveRun('r1', 'blocked');
    expect(planStore.getState().runStatus).toBe('blocked');

    applyPlan('r1', { gain: 2 } as never);
    expect(planStore.getState().plan).toEqual({ gain: 2 });

    openHeroes(['h2']);
    expect(planStore.getState().openHeroIds).toEqual(['h2']);

    clearPlan();
    expect(planStore.getState()).toEqual({
      runStatus: 'idle',
      runId: null,
      plan: null,
      signature: null,
      heroes: null,
      openHeroIds: null,
    });
  });
});

describe('optimizerSnapshotStale', () => {
  it('is false when nothing has been snapshotted', () => {
    const { store } = createOptimizerStore();
    expect(optimizerSnapshotStale(store.getState(), null)).toBe(false);
  });

  it('is false for a gold-only live change', () => {
    const { store, open } = createOptimizerStore();
    const opened = viewAtLevel(10);
    open(opened.view, opened.key, null);

    const liveView = viewOf(payloadWithGold(10, '999')).view;
    expect(optimizerSnapshotStale(store.getState(), liveView)).toBe(false);
  });

  it('is true once a hero has levelled up on the live account', () => {
    const { store, open } = createOptimizerStore();
    const opened = viewAtLevel(10);
    open(opened.view, opened.key, null);

    const liveView = viewAtLevel(11).view;
    expect(optimizerSnapshotStale(store.getState(), liveView)).toBe(true);
  });
});

describe('the runner is the package runner, owned by this store and never subscribed to here', () => {
  it('the source calls no runner.subscribe and no runner.run', () => {
    const source = readFileSync(path.join(__dirname, 'use-optimizer-snapshot.ts'), 'utf8');
    expect(source).not.toMatch(/runner\.run\(|runner\.subscribe\(/);
  });
});

type FakeGlobal = { localStorage?: Storage };

function installStorage(entries: Record<string, string>): void {
  const store = new Map(Object.entries(entries));
  (globalThis as unknown as FakeGlobal).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    length: 0,
  };
}

describe('the exposed runner falls back to the main thread when the worker cannot be built', () => {
  afterEach(() => {
    delete (globalThis as unknown as FakeGlobal).localStorage;
  });

  it('a solvable input still produces a plan, labelled ranOnMainThread', () => {
    installStorage({ 'bfc-e2e-optimizer-no-worker': '1', 'bf-e2e-team-plan-max-eval': '50' });

    const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
    const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
    const view: AccountView = { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
    const result = buildOptimizerInputs(view, null);
    if (result === null) throw new Error('expected inputs from the offline fixture');
    const input = buildTeamPlanInput(result.inputs, DEFAULT_TEAM_PLAN_CONTROLS);

    const { runner } = createOptimizerStore();
    runner.run(input);

    expect(runner.ranOnMainThread).toBe(true);
    expect(runner.status === 'done' || runner.status === 'blocked').toBe(true);
  });
});

