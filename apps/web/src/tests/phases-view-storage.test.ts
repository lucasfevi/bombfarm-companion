import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPhasesView,
  loadPhasesView,
  savePhasesView,
} from '@/features/phases/model/phases-view-storage';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('phases-view-storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to phase 1', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    expect(loadPhasesView()).toEqual(defaultPhasesView());
  });

  it('clamps saved phase to 1..600', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    savePhasesView({ phase: 9999 });
    expect(loadPhasesView().phase).toBe(600);
    savePhasesView({ phase: 0 });
    expect(loadPhasesView().phase).toBe(1);
  });

  it('round-trips phase selection', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    savePhasesView({ phase: 42 });
    expect(loadPhasesView().phase).toBe(42);
  });

  // Farm Ranking T2: the additive farmPool / farmReturnBonus normalize table.
  describe('farmPool / farmReturnBonus normalize (design §6.1)', () => {
    it('the literal shipped payload {"phase":151} loads with the phase preserved, pool empty, bonus off, objective gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":151}');
      expect(loadPhasesView()).toEqual({
        phase: 151,
        farmPool: {},
        farmReturnBonus: 'off',
        farmObjective: 'gold',
      });
    });

    it('the shipped three-field payload {phase, farmPool, farmReturnBonus} loads with objective defaulted to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem(
        'bf-hp-phases-view-v1',
        '{"phase":12,"farmPool":{"h1":true},"farmReturnBonus":"vip"}',
      );
      expect(loadPhasesView()).toEqual({
        phase: 12,
        farmPool: { h1: true },
        farmReturnBonus: 'vip',
        farmObjective: 'gold',
      });
    });

    it('non-JSON, an array, and null all fall back to the default with no throw', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', 'not json{');
      expect(loadPhasesView()).toEqual(defaultPhasesView());
      localStorage.setItem('bf-hp-phases-view-v1', '[1,2,3]');
      expect(loadPhasesView()).toEqual(defaultPhasesView());
      localStorage.setItem('bf-hp-phases-view-v1', 'null');
      expect(loadPhasesView()).toEqual(defaultPhasesView());
    });

    it('a non-object farmPool drops to {}', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmPool":"nope"}');
      expect(loadPhasesView().farmPool).toEqual({});
    });

    it('a farmPool entry whose value is not boolean is dropped; boolean siblings are kept', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem(
        'bf-hp-phases-view-v1',
        '{"phase":1,"farmPool":{"a":true,"b":"nope","c":false}}',
      );
      expect(loadPhasesView().farmPool).toEqual({ a: true, c: false });
    });

    it('a farmPool entry keyed by the empty string is dropped', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmPool":{"":true,"x":true}}');
      expect(loadPhasesView().farmPool).toEqual({ x: true });
    });

    it('a farmPool with more than 200 entries keeps only the first 200', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      const bigPool: Record<string, boolean> = {};
      for (let index = 0; index < 250; index++) bigPool[`hero-${index}`] = true;
      localStorage.setItem(
        'bf-hp-phases-view-v1',
        JSON.stringify({ phase: 1, farmPool: bigPool }),
      );
      expect(Object.keys(loadPhasesView().farmPool ?? {})).toHaveLength(200);
    });

    it('a farmPool key naming a hero id not in the roster is kept in storage (pruning happens on use, not on read)', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmPool":{"ghost-hero":false}}');
      expect(loadPhasesView().farmPool).toEqual({ 'ghost-hero': false });
    });

    it('farmReturnBonus outside the three literals normalizes to off', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmReturnBonus":"standard"}');
      expect(loadPhasesView().farmReturnBonus).toBe('off');
    });

    it("farmReturnBonus 'on' and 'vip' round-trip as themselves", () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmReturnBonus":"on"}');
      expect(loadPhasesView().farmReturnBonus).toBe('on');
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmReturnBonus":"vip"}');
      expect(loadPhasesView().farmReturnBonus).toBe('vip');
    });

    it('defaultPhasesView() omits farmPool/farmReturnBonus/farmObjective so an untouched payload stays byte-identical', () => {
      expect(defaultPhasesView()).toEqual({ phase: 1 });
      expect(Object.keys(defaultPhasesView())).toEqual(['phase']);
    });
  });

  // Farm Respec Advisor T2: the additive farmObjective normalize table (design §6).
  describe('farmObjective normalize (design §6)', () => {
    it('absent farmObjective normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });

    it('each of the three preset literals round-trips as itself', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      for (const kind of ['gold', 'chests', 'blend']) {
        localStorage.setItem('bf-hp-phases-view-v1', JSON.stringify({ phase: 1, farmObjective: kind }));
        expect(loadPhasesView().farmObjective).toBe(kind);
      }
    });

    it('an unrecognized string normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmObjective":"bogus"}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });

    it('a number normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmObjective":7}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });

    it('null normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmObjective":null}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });

    it('an array normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmObjective":["gold"]}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });

    it('an object normalizes to gold', () => {
      vi.stubGlobal('localStorage', memoryLocalStorage());
      localStorage.setItem('bf-hp-phases-view-v1', '{"phase":1,"farmObjective":{"kind":"blend"}}');
      expect(loadPhasesView().farmObjective).toBe('gold');
    });
  });
});
