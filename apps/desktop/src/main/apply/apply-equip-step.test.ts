import { describe, expect, it } from 'vitest';
import type { ApplyEquipUnit } from '@bombfarm/contracts';
import { WRITE_ROUTES, type WriteCall } from '@bombfarm/game-api';
import type { ApplyCallVerdict } from './apply-outcome.js';
import type { ApplyRunContext } from './apply-run-context.js';
import { runEquipUnit } from './apply-equip-step.js';

const EQUIP_UNIT: ApplyEquipUnit = {
  index: 0,
  call: 'equip',
  itemId: 'g1',
  defId: 'steel_luva',
  slot: '2',
  fromHeroId: null,
  toHeroId: 'h7',
  displacesItemId: null,
  freedByIndex: null,
  pendingAt: [null],
  doneAt: ['h7'],
};

const UNEQUIP_UNIT: ApplyEquipUnit = {
  ...EQUIP_UNIT,
  call: 'unequip',
  toHeroId: null,
  pendingAt: ['h7'],
  doneAt: [null],
};

function fakeContext(answer: ApplyCallVerdict | { kind: 'stop'; stop: 'unauthorized' | 'network' | 'refused' | 'stopped' | 'consent_revoked' | 'game_not_running'; code: null }) {
  const calls: { kind: string; writeCall: WriteCall }[] = [];
  const ctx: ApplyRunContext = {
    call: (kind, writeCall) => {
      calls.push({ kind, writeCall });
      return Promise.resolve(answer);
    },
    readDetail: () => Promise.reject(new Error('not used by the equip step')),
    wallet: () => null,
  };
  return { ctx, calls };
}

describe('runEquipUnit', () => {
  it('an equip unit calls ctx.call with the item and its target hero', async () => {
    const { ctx, calls } = fakeContext({ kind: 'ok' });
    await runEquipUnit(EQUIP_UNIT, ctx);
    expect(calls).toEqual([{ kind: 'equip', writeCall: { route: WRITE_ROUTES.equip, item: 'g1', hero: 'h7' } }]);
  });

  it('an unequip unit calls ctx.call with only the item', async () => {
    const { ctx, calls } = fakeContext({ kind: 'ok' });
    await runEquipUnit(UNEQUIP_UNIT, ctx);
    expect(calls).toEqual([{ kind: 'unequip', writeCall: { route: WRITE_ROUTES.unequip, item: 'g1' } }]);
  });

  it('an ok verdict becomes an ok result with no gold spent', async () => {
    const { ctx } = fakeContext({ kind: 'ok' });
    expect(await runEquipUnit(EQUIP_UNIT, ctx)).toEqual({ kind: 'ok', goldSpent: 0 });
  });

  it('a skip verdict passes through unchanged', async () => {
    const { ctx } = fakeContext({ kind: 'skip', reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' });
    expect(await runEquipUnit(EQUIP_UNIT, ctx)).toEqual({ kind: 'skip', reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' });
  });

  it('a skip verdict with no code passes through unchanged', async () => {
    const { ctx } = fakeContext({ kind: 'skip', reason: 'itemMissing' });
    expect(await runEquipUnit(EQUIP_UNIT, ctx)).toEqual({ kind: 'skip', reason: 'itemMissing' });
  });

  it('a stop verdict becomes a stop result naming the call it was attempting', async () => {
    const { ctx } = fakeContext({ kind: 'stop', stop: 'unauthorized', code: null });
    expect(await runEquipUnit(EQUIP_UNIT, ctx)).toEqual({ kind: 'stop', stop: 'unauthorized', code: null, call: 'equip', resetDone: false });
  });

  it('a stop verdict on an unequip unit names unequip', async () => {
    const { ctx } = fakeContext({ kind: 'stop', stop: 'refused', code: 'SERVER_LOCKED' });
    expect(await runEquipUnit(UNEQUIP_UNIT, ctx)).toEqual({ kind: 'stop', stop: 'refused', code: 'SERVER_LOCKED', call: 'unequip', resetDone: false });
  });
});
