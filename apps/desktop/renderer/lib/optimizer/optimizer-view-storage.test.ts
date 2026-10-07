import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import { applyTeamPlanControlChange, resolveHeroScope } from '@bombfarm/team-plan/core';
import { DEFAULT_TEAM_PLAN_RESULT_SORT } from '@bombfarm/team-plan/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  DEFAULT_OPTIMIZER_VIEW,
  loadOptimizerResultSort,
  loadOptimizerView,
  migrateOptimizerScopeOnce,
  saveOptimizerResultSort,
  saveOptimizerView,
  type OptimizerView,
} from './optimizer-view-storage';

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
      objective: 'pvp',
      allowedChanges: 'gear',
      forgeFloor: 7,
      ignoreFieldCrowding: true,
      aurasAtCap: ['marcha_acelerada'],
      targetPhase: 40,
      targetPhaseChosen: true,
      gatePhase: 150,
      farmSet: 'clay',
    };
    saveOptimizerView(view);
    expect(loadOptimizerView()).toEqual(view);
  });

  it('keeps only real aura ids out of the stored list, and the frozen empty list otherwise', () => {
    entries.set(KEY, JSON.stringify({ aurasAtCap: ['brecha', 'nope'] }));
    expect(loadOptimizerView().aurasAtCap).toEqual(['brecha']);
    entries.set(KEY, JSON.stringify({ aurasAtCap: true }));
    expect(loadOptimizerView().aurasAtCap).toBe(DEFAULT_OPTIMIZER_VIEW.aurasAtCap);
  });

  it('keeps a set the game drops and reads anything else as no set', () => {
    entries.set(KEY, JSON.stringify({ objective: 'setFarm', farmSet: 'void' }));
    expect(loadOptimizerView()).toMatchObject({ objective: 'setFarm', farmSet: 'void' });
    entries.set(KEY, JSON.stringify({ farmSet: 'not-a-set' }));
    expect(loadOptimizerView().farmSet).toBeNull();
    entries.set(KEY, JSON.stringify({ farmSet: 7 }));
    expect(loadOptimizerView().farmSet).toBeNull();
    entries.set(KEY, JSON.stringify({ objective: 'pvp' }));
    expect(loadOptimizerView().farmSet).toBeNull();
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
    entries.set(KEY, JSON.stringify({ objective: 'gateClear' }));
    expect(loadOptimizerView()).toEqual({ ...DEFAULT_OPTIMIZER_VIEW, objective: 'gateClear' });
  });

  it('the rotation objective the control no longer offers reads back as the default', () => {
    entries.set(KEY, JSON.stringify({ objective: 'dps' }));
    expect(loadOptimizerView().objective).toBe(DEFAULT_OPTIMIZER_VIEW.objective);
  });

  it('keeps a stored gate only while it names a gate', () => {
    entries.set(KEY, JSON.stringify({ gatePhase: 100 }));
    expect(loadOptimizerView().gatePhase).toBe(100);
    entries.set(KEY, JSON.stringify({ gatePhase: 101 }));
    expect(loadOptimizerView().gatePhase).toBeNull();
    entries.set(KEY, JSON.stringify({ gatePhase: '100' }));
    expect(loadOptimizerView().gatePhase).toBeNull();
  });

  it('ignores a stored plan-shaped value, reading it as the defaults', () => {
    entries.set(KEY, JSON.stringify({ plan: { gain: 1 } }));
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });
});

describe('optimizer result order', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('is stored apart from the controls, so reordering the rows never touches what a plan is solved from', () => {
    saveOptimizerResultSort({ key: 'delta', direction: 'desc' });
    expect(entries.has(KEY)).toBe(false);
    expect(loadOptimizerResultSort()).toEqual({ key: 'delta', direction: 'desc' });
    expect(loadOptimizerView()).toEqual(DEFAULT_OPTIMIZER_VIEW);
  });

  it('reads the default order when nothing, or nothing readable, was stored', () => {
    expect(loadOptimizerResultSort()).toEqual(DEFAULT_TEAM_PLAN_RESULT_SORT);
    entries.set('bfc-optimizer-result-sort', '{not json');
    expect(loadOptimizerResultSort()).toEqual(DEFAULT_TEAM_PLAN_RESULT_SORT);
  });
});

function roster(...heroes: { id: string; battleAllowed: boolean }[]): HeroRecord[] {
  return heroes as unknown as HeroRecord[];
}

describe('optimizer scope map', () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });

  it('a hero whose battle is turned back on resolves to optimize after another hero was dragged', () => {
    const before = roster({ id: 'a', battleAllowed: true }, { id: 'b', battleAllowed: false });
    const moved = applyTeamPlanControlChange(
      DEFAULT_OPTIMIZER_VIEW,
      { kind: 'scope', heroId: 'a', scope: 'leaveAlone' },
      { heroes: before, farmChosenPhase: null, phase: null },
    );
    saveOptimizerView(moved?.controls ?? DEFAULT_OPTIMIZER_VIEW);
    const reloaded = loadOptimizerView();
    expect(reloaded.scopeByHeroId).toEqual({ a: 'leaveAlone' });
    expect(resolveHeroScope({ id: 'b', battleAllowed: true }, reloaded.scopeByHeroId)).toBe('optimize');
  });

  it('a drag to the hero default column is stored and survives a later battle toggle', () => {
    const heroes = roster({ id: 'a', battleAllowed: false });
    const moved = applyTeamPlanControlChange(
      DEFAULT_OPTIMIZER_VIEW,
      { kind: 'scope', heroId: 'a', scope: 'donate' },
      { heroes, farmChosenPhase: null, phase: null },
    );
    saveOptimizerView(moved?.controls ?? DEFAULT_OPTIMIZER_VIEW);
    const reloaded = loadOptimizerView();
    expect(reloaded.scopeByHeroId).toEqual({ a: 'donate' });
    expect(resolveHeroScope({ id: 'a', battleAllowed: true }, reloaded.scopeByHeroId)).toBe('donate');
  });

  it('explicit Donate and Leave alone choices survive a save and reload', () => {
    saveOptimizerView({ ...DEFAULT_OPTIMIZER_VIEW, scopeByHeroId: { a: 'donate', b: 'leaveAlone' } });
    expect(loadOptimizerView().scopeByHeroId).toEqual({ a: 'donate', b: 'leaveAlone' });
  });

  describe('one-off cleanup of a materialised map', () => {
    const heroes = roster(
      { id: 'a', battleAllowed: true },
      { id: 'b', battleAllowed: true },
      { id: 'c', battleAllowed: false },
      { id: 'd', battleAllowed: false },
    );
    const materialised: OptimizerView = {
      ...DEFAULT_OPTIMIZER_VIEW,
      scopeByHeroId: { a: 'optimize', b: 'donate', c: 'donate', d: 'optimize' },
    };

    it('drops entries equal to the default and Donate on a battle-enabled hero, and writes the cleaned view', () => {
      const migrated = migrateOptimizerScopeOnce(heroes, materialised);
      expect(migrated?.scopeByHeroId).toEqual({ d: 'optimize' });
      expect(loadOptimizerView().scopeByHeroId).toEqual({ d: 'optimize' });
    });

    it('runs once: a later call with another materialised map leaves it alone', () => {
      migrateOptimizerScopeOnce(heroes, materialised);
      expect(migrateOptimizerScopeOnce(heroes, materialised)).toBeNull();
    });

    it('waits for a roster and is not spent by an empty one', () => {
      expect(migrateOptimizerScopeOnce([], materialised)).toBeNull();
      expect(migrateOptimizerScopeOnce(heroes, materialised)?.scopeByHeroId).toEqual({ d: 'optimize' });
    });

    it('leaves a choice made after the cleanup alone, even one equal to the default', () => {
      migrateOptimizerScopeOnce(heroes, materialised);
      const later: OptimizerView = { ...DEFAULT_OPTIMIZER_VIEW, scopeByHeroId: { a: 'optimize' } };
      expect(migrateOptimizerScopeOnce(heroes, later)).toBeNull();
      expect(loadOptimizerView().scopeByHeroId).toEqual({ d: 'optimize' });
    });
  });
});
