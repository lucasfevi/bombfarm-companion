import { describe, expect, it } from 'vitest';
import { POINTS_TRIM_MAX_LOSS_PCT, trimTowardCurrent } from '@bombfarm/domain/points-trim';
import type { SheetKey } from '@bombfarm/domain/planner-constants';

type Pts = Record<SheetKey, number>;

const zero: Pts = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
const pts = (partial: Partial<Pts>): Pts => ({ ...zero, ...partial });

function linear(weights: Partial<Pts>, base = 1000) {
  return (vectors: Map<string, Pts>) => {
    let value = base;
    for (const vector of vectors.values()) {
      for (const [key, weight] of Object.entries(weights) as [SheetKey, number][]) value += vector[key] * weight;
    }
    return value;
  };
}

function trim(current: Pts, proposed: Pts, evaluate: (vectors: Map<string, Pts>) => number, maxEvaluations = 500) {
  const currentVectors = new Map([['h', current]]);
  const proposedVectors = new Map([['h', proposed]]);
  return trimTowardCurrent({
    current: currentVectors,
    proposed: proposedVectors,
    proposedValue: evaluate(proposedVectors),
    currentValue: evaluate(currentVectors),
    evaluate,
    maxEvaluations,
  });
}

describe('trimTowardCurrent', () => {
  it('leaves a banked point unspent when spending it buys almost nothing, and keeps the change that pays', () => {
    const result = trim(pts({ attack: 10 }), pts({ attack: 30, speed: 1 }), linear({ attack: 10, speed: 0.01 }));

    expect(result.vectors.get('h')).toEqual(pts({ attack: 30 }));
  });

  it('moves a near-worthless reallocation back where the player had it', () => {
    const result = trim(
      pts({ attack: 50, critDmg: 10 }),
      pts({ attack: 70, critDmg: 8, speed: 2 }),
      linear({ attack: 10, critDmg: 0.02, speed: 0.03 }),
    );

    expect(result.vectors.get('h')).toEqual(pts({ attack: 70, critDmg: 10 }));
  });

  it('bounds the loss in total, so many small changes are not all dropped together', () => {
    // Each of the five one-point changes is worth 0.2% of the proposal's value.
    const result = trim(
      pts({}),
      pts({ attack: 1, energy: 1, speed: 1, critChance: 1, critDmg: 1 }),
      linear({ attack: 2, energy: 2, speed: 2, critChance: 2, critDmg: 2 }, 990),
    );

    const trimmed = result.vectors.get('h')!;
    const changesLeft = (['attack', 'energy', 'speed', 'critChance', 'critDmg'] as const).filter((key) => trimmed[key] > 0);
    expect(changesLeft).toHaveLength(3);
    expect(result.value).toBeGreaterThanOrEqual(1000 * (1 - POINTS_TRIM_MAX_LOSS_PCT / 100));
  });

  it('hands back the current vector when the whole proposal is worth less than the bound', () => {
    const result = trim(pts({ attack: 10 }), pts({ attack: 8, speed: 2 }), linear({ attack: 1, speed: 2 }));

    expect(result.vectors.get('h')).toEqual(pts({ attack: 10 }));
    expect(result.evaluations).toBe(0);
  });

  it('never lands below the current vector', () => {
    const current = pts({ attack: 10, speed: 10 });
    const evaluate = linear({ attack: 10, speed: 9.99 });
    const result = trim(current, pts({ attack: 20 }), evaluate);

    expect(result.value).toBeGreaterThanOrEqual(evaluate(new Map([['h', current]])));
  });

  it('stops at its evaluation bound', () => {
    const result = trim(pts({}), pts({ attack: 1, speed: 1 }), linear({ attack: 100, speed: 0.001 }, 10), 1);

    expect(result.evaluations).toBe(1);
  });

  it('trims each hero against its own current vector', () => {
    const evaluate = linear({ attack: 10, speed: 0.01 });
    const current = new Map([
      ['a', pts({ attack: 10 })],
      ['b', pts({ attack: 10 })],
    ]);
    const proposed = new Map([
      ['a', pts({ attack: 30, speed: 1 })],
      ['b', pts({ attack: 9, speed: 1 })],
    ]);
    const result = trimTowardCurrent({
      current,
      proposed,
      proposedValue: evaluate(proposed),
      currentValue: evaluate(current),
      evaluate,
      maxEvaluations: 500,
    });

    expect(result.vectors.get('a')).toEqual(pts({ attack: 30 }));
    expect(result.vectors.get('b')).toEqual(pts({ attack: 10 }));
  });
});
