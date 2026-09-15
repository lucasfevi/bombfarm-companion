import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import { DEFAULT_OPTIMIZER_VIEW, loadOptimizerView, saveOptimizerView, type OptimizerView } from './optimizer-view-storage';

const KEY = 'bfc-optimizer-view';

type FakeWindow = { localStorage: Storage };

function installStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
  (globalThis as unknown as { window?: FakeWindow }).window = { localStorage: storage };
  return entries;
}

describe('optimizer view preferences', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('is stored under its own key, never the farm view key or the web planner key', () => {
    saveOptimizerView({ ...DEFAULT_OPTIMIZER_VIEW, forgeFloor: 5 });
    expect([...entries.keys()]).toEqual([KEY]);
  });

  it('round-trips what was written', () => {
    const view: OptimizerView = {
      scopeByHeroId: { h1: 'donate' },
      objective: 'dps',
      allowedChanges: 'gear',
      forgeFloor: 7,
      ignoreFieldCrowding: true,
      targetPhase: 40,
      targetPhaseChosen: true,
    };
    saveOptimizerView(view);
    expect(loadOptimizerView()).toEqual(view);
  });

  it('reads as the defaults when nothing is stored', () => {
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });

  it('reads as the defaults for an unparseable value, without throwing', () => {
    entries.set(KEY, '{not json');
    expect(() => loadOptimizerView()).not.toThrow();
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });

  it('reads as the defaults when localStorage is unreachable', () => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });

  it('rejects an objective outside the vocabulary', () => {
    entries.set(KEY, JSON.stringify({ objective: 'quadruple' }));
    expect(loadOptimizerView().objective).toBe(DEFAULT_OPTIMIZER_VIEW.objective);
  });

  it('rejects an allowed-changes value outside the vocabulary', () => {
    entries.set(KEY, JSON.stringify({ allowedChanges: 'all' }));
    expect(loadOptimizerView().allowedChanges).toBe(DEFAULT_OPTIMIZER_VIEW.allowedChanges);
  });

  it('keeps only the scope entries whose value is a real scope state', () => {
    entries.set(KEY, JSON.stringify({ scopeByHeroId: { h1: 'optimize', h2: 'yes', h3: 7 } }));
    expect(loadOptimizerView().scopeByHeroId).toEqual({ h1: 'optimize' });
  });

  it.each([
    ['NaN', NaN, 10],
    ['-3', -3, 0],
    ['12.5', 12.5, 13],
    ['99', 99, FORJA_MAX],
  ])('clamps a forge floor of %s to %s', (_label, stored, expected) => {
    entries.set(KEY, JSON.stringify({ forgeFloor: stored }));
    expect(loadOptimizerView().forgeFloor).toBe(expected);
  });

  it.each([
    ['0', 0],
    ['-3', -3],
    ["'30'", '30'],
    ['null', null],
  ])('reads a target phase of %s as null', (_label, stored) => {
    entries.set(KEY, JSON.stringify({ targetPhase: stored }));
    expect(loadOptimizerView().targetPhase).toBeNull();
  });

  it('rounds a fractional target phase through the package clamp', () => {
    entries.set(KEY, JSON.stringify({ targetPhase: 12.5 }));
    expect(loadOptimizerView().targetPhase).toBe(13);
  });

  it('caps an out-of-range target phase through the package clamp', () => {
    entries.set(KEY, JSON.stringify({ targetPhase: 900 }));
    expect(loadOptimizerView().targetPhase).toBe(600);
  });

  it('round-trips a chosen None (targetPhase null, targetPhaseChosen true)', () => {
    const view: OptimizerView = {
      ...DEFAULT_OPTIMIZER_VIEW,
      targetPhase: null,
      targetPhaseChosen: true,
    };
    saveOptimizerView(view);
    expect(loadOptimizerView()).toEqual(view);
  });

  it('normalises a partial record into a whole one, filling every missing field with its default', () => {
    entries.set(KEY, JSON.stringify({ objective: 'dps' }));
    expect(loadOptimizerView()).toEqual({ ...DEFAULT_OPTIMIZER_VIEW, objective: 'dps' });
  });

  it('ignores a stored plan-shaped value, reading it as the defaults', () => {
    entries.set(KEY, JSON.stringify({ plan: { gain: 1 } }));
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });
});
