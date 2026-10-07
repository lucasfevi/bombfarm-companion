/**
 * The delegate is replaced by a spy rather than left to run for two reasons, and both are the
 * point of the file: a compute that really runs cannot be made to THROW on demand, so the
 * `compute-failed` branch would stay unreachable, and a real 600-row table would say nothing about
 * which arguments arrived. What this boundary owes is the argument mapping, the two short-circuits
 * and the failure surface — the arithmetic is @bombfarm/domain's own, tested there.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@bombfarm/domain/farm-rate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bombfarm/domain/farm-rate')>();
  return { ...actual, computeFarmRates: vi.fn(actual.computeFarmRates) };
});

import { computeFarmRates, type FarmRateRow } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { computeFarmRanking } from './farm-compute';
import type { FarmInputs } from './farm-inputs';

const delegate = vi.mocked(computeFarmRates);

const ROW = { phase: 1, ato: 1, goldPerHour: 1_000_000 } as unknown as FarmRateRow;
const DELEGATE_RESULT = {
  heroFacts: [],
  squad: {},
  rows: [ROW],
} as unknown as ReturnType<typeof computeFarmRates>;

function hero(id: string, battleAllowed?: boolean): HeroRecord {
  return { id, name: id, battleAllowed } as unknown as HeroRecord;
}

const HEROES: readonly HeroRecord[] = [
  hero('unflagged'),
  hero('allowed', true),
  hero('barred', false),
];

/**
 * Every numeric field holds a DIFFERENT invented integer, and none of them resembles a real
 * account: the delegate is mocked, so nothing here is ever arithmetic, and a distinct value per
 * field is what catches a member wired to the wrong destination. Two fields sharing a value —
 * `slots` and `fieldSlots`, or `houseIdx` and `houseCycleSecsHouseIdx` — would hide exactly the
 * swap this file exists to detect.
 */
function baseInputs(overrides: Partial<FarmInputs> = {}): FarmInputs {
  return {
    heroes: HEROES,
    treeDanoTotal: 10,
    treeCritChance: 11,
    treeCritDmg: 12,
    treeSpeed: 13,
    treeEnergy: 14,
    treeTeamCoinPct: 15,
    treeLuckFlatPct: 16,
    houseIdx: 2,
    houseLevel: 3,
    slots: 4,
    fieldSlots: 5,
    houseCycleSecs: 100,
    houseCycleSecsHouseIdx: 6,
    houseCycleSecsLevel: 7,
    maxPhase: 8,
    farmPoolOverrides: {},
    farmReturnBonus: 'vip',
    aurasAtCap: ['grito_guerra'],
    ...overrides,
  };
}

beforeEach(() => {
  delegate.mockReset();
  delegate.mockReturnValue(DELEGATE_RESULT);
});

describe('computeFarmRanking — what actually reaches the delegate', () => {
  it('hands over the roster by reference, the resolved pool, the return bonus and the max phase', () => {
    const inputs = baseInputs({ farmPoolOverrides: { barred: true, allowed: false } });

    const result = computeFarmRanking(inputs);

    expect(delegate).toHaveBeenCalledTimes(1);
    const input = delegate.mock.calls[0][0];
    expect(input.heroes).toBe(inputs.heroes);
    expect(input.enabledHeroIds).toEqual(['unflagged', 'barred']);
    expect(input.returnBonus).toBe('vip');
    expect(input.maxPhase).toBe(8);
    expect(result).toEqual({ rows: [ROW], reason: null });
  });

  it('resolves the pool as the override first and the save second, so an absent override follows battleAllowed', () => {
    computeFarmRanking(baseInputs());

    expect(delegate.mock.calls[0][0].enabledHeroIds).toEqual(['unflagged', 'allowed']);
  });

  it('builds the account from the same inputs — tree, House pair, both slot caps, maxPhase and the aura assumption', () => {
    const inputs = baseInputs();

    computeFarmRanking(inputs);

    const { account } = delegate.mock.calls[0][0];
    expect(account.tree).toEqual({
      danoTotal: 10,
      critChance: 11,
      critDmg: 12,
      speed: 13,
      energy: 14,
      teamCoinPct: 15,
      luckFlatPct: 16,
    });
    expect(account.context.houseIdx).toBe(2);
    expect(account.context.houseLevel).toBe(3);
    expect(account.slots).toBe(4);
    expect(account.fieldSlots).toBe(5);
    expect(account.houseCycleSecs).toBe(100);
    expect(account.houseCycleSecsHouseIdx).toBe(6);
    expect(account.houseCycleSecsLevel).toBe(7);
    expect(account.maxPhase).toBe(8);
    expect(account.aurasAtCap).toBe(inputs.aurasAtCap);
  });

  it('omits the House slots key entirely when the host has no figure, rather than sending it undefined', () => {
    computeFarmRanking(baseInputs({ slots: undefined }));

    expect('slots' in delegate.mock.calls[0][0].account).toBe(false);
  });

  it('returns the delegate’s rows untouched, and never an infeasible-row placeholder of its own', () => {
    const rows = [ROW, ROW];
    delegate.mockReturnValue({ ...DELEGATE_RESULT, rows });

    expect(computeFarmRanking(baseInputs()).rows).toBe(rows);
  });
});

describe('computeFarmRanking — an empty pool is short-circuited BEFORE the delegate', () => {
  const emptyPools: readonly { readonly label: string; readonly inputs: FarmInputs; readonly reason: string }[] = [
    { label: 'no roster at all', inputs: baseInputs({ heroes: [] }), reason: 'no-roster' },
    {
      label: 'a roster every override has switched off',
      inputs: baseInputs({ farmPoolOverrides: { unflagged: false, allowed: false, barred: false } }),
      reason: 'no-heroes-enabled',
    },
    {
      label: 'a roster the save itself bars from battle',
      inputs: baseInputs({ heroes: [hero('barred', false), hero('also-barred', false)] }),
      reason: 'no-heroes-enabled',
    },
  ];

  for (const { label, inputs, reason } of emptyPools) {
    it(`reports ${reason} with no rows for ${label}`, () => {
      expect(computeFarmRanking(inputs)).toEqual({ rows: [], reason });
    });

    it(`never calls the delegate for ${label} — 600 rows of zeros marked infeasible is what that would return`, () => {
      computeFarmRanking(inputs);

      expect(delegate).not.toHaveBeenCalled();
    });
  }

  it('hands back the same frozen-empty rows array every time, so a host subscribed to it does not re-render', () => {
    const first = computeFarmRanking(baseInputs({ heroes: [] }));
    const second = computeFarmRanking(baseInputs({ farmPoolOverrides: { unflagged: false, allowed: false } }));

    expect(first.rows).toBe(second.rows);
    expect(first.reason).not.toBe(second.reason);
  });
});

describe('computeFarmRanking — a throwing delegate becomes a named reason, not an empty board', () => {
  it('reports compute-failed when the delegate throws an Error', () => {
    delegate.mockImplementation(() => {
      throw new Error('injected: the delegate could not build the squad');
    });

    expect(computeFarmRanking(baseInputs())).toEqual({ rows: [], reason: 'compute-failed' });
  });

  it('reports compute-failed for a thrown non-Error too — the boundary catches the throw, not its shape', () => {
    const bareString: unknown = 'injected: a bare string';
    delegate.mockImplementation(() => {
      throw bareString;
    });

    expect(computeFarmRanking(baseInputs())).toEqual({ rows: [], reason: 'compute-failed' });
  });

  it('does not rethrow, so a host rendering the board survives the failure', () => {
    delegate.mockImplementation(() => {
      throw new Error('injected');
    });

    expect(() => computeFarmRanking(baseInputs())).not.toThrow();
  });

  it('distinguishes a failure from an empty pool — same empty rows, different reason', () => {
    delegate.mockImplementation(() => {
      throw new Error('injected');
    });

    const failed = computeFarmRanking(baseInputs());
    const empty = computeFarmRanking(baseInputs({ heroes: [] }));

    expect(failed.rows).toEqual(empty.rows);
    expect([failed.reason, empty.reason]).toEqual(['compute-failed', 'no-roster']);
  });

  it('recovers on the next call once the delegate stops throwing — the reason is per-call, not sticky', () => {
    delegate.mockImplementationOnce(() => {
      throw new Error('injected');
    });

    expect(computeFarmRanking(baseInputs()).reason).toBe('compute-failed');
    expect(computeFarmRanking(baseInputs())).toEqual({ rows: [ROW], reason: null });
  });
});
