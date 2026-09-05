import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { createForgeDpsEvaluator } from './forge-dps';

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function offlineFixture(): AccountPayload {
  const file = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
  return JSON.parse(readFileSync(file, 'utf8')) as AccountPayload;
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function wornGear(payload: AccountPayload): InventoryViewItem[] {
  return buildInventoryView(payload.items).items.filter(
    (item) => item.kind === 'equipment' && item.equippedBy !== null && item.upgrade < 15,
  );
}

describe('createForgeDpsEvaluator', () => {
  const payload = offlineFixture();
  const evaluator = required(createForgeDpsEvaluator(viewOf(payload)), 'the offline fixture is a full account');
  const piece = required(wornGear(payload)[0], 'the fixture wears at least one piece below +15');
  const wearer = required(piece.equippedBy, 'a worn piece names its wearer');

  it('reads the wearer at the current forge as the board does, and a step up as a strict gain', () => {
    const now = required(evaluator.dpsAt(wearer, piece, piece.upgrade), 'the wearer has a DPS');
    const next = required(evaluator.dpsAt(wearer, piece, piece.upgrade + 1), 'and one at the next rung');
    expect(now).toBeGreaterThan(0);
    expect(next).toBeGreaterThan(now);
  });

  it('prints the delta as a fraction of the current figure, zero at the current forge', () => {
    expect(evaluator.deltaAt(wearer, piece, piece.upgrade)).toBe(0);
    const delta = required(evaluator.deltaAt(wearer, piece, piece.upgrade + 1), 'a delta');
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1);
  });

  it('grows monotonically with the target, because the forge multiplier is flat', () => {
    const deltas = [piece.upgrade + 1, piece.upgrade + 2, 15].map((target) =>
      required(evaluator.deltaAt(wearer, piece, target), `a delta at +${String(target)}`),
    );
    expect(deltas[0]).toBeLessThan(deltas[1] ?? 0);
    expect(deltas[1]).toBeLessThan(deltas[2] ?? 0);
  });

  it('says nothing about a hero it cannot find, or a piece that is not in that hero\'s slot', () => {
    expect(evaluator.deltaAt('no-such-hero', piece, piece.upgrade + 1)).toBeNull();
    expect(evaluator.deltaAt(wearer, { ...piece, defId: 'not-what-they-wear' }, piece.upgrade + 1)).toBeNull();
    expect(evaluator.deltaAt(wearer, { ...piece, slot: null }, piece.upgrade + 1)).toBeNull();
  });

  it('answers the same figure twice from memory rather than a second pipeline run', () => {
    const first = evaluator.dpsAt(wearer, piece, piece.upgrade + 1);
    const second = evaluator.dpsAt(wearer, piece, piece.upgrade + 1);
    expect(second).toBe(first);
  });

  it('is withheld whole when a section the board needs is not usable', () => {
    const fidelity = required(payload.fidelity, 'the fixture asserts fidelity');
    const withheld = { ...payload, fidelity: { ...fidelity, skills: { status: 'missing' as const } } };
    expect(createForgeDpsEvaluator(viewOf(withheld))).toBeNull();
    expect(createForgeDpsEvaluator(null)).toBeNull();
  });
});
