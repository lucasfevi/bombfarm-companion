import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { patchAccountAfterForge } from './forge-account-patch.js';

const NOW = '2026-09-05T10:00:30.000Z';
const EARLIER = '2026-09-05T09:00:00.000Z';

const PAYLOAD: AccountPayload = {
  account: { gold: 1_000_000, phase: 12 },
  items: [
    { id: 'g1', def_id: 'steel_luva', upgrade: 8, power: 40 },
    { id: 'g2', def_id: 'steel_elmo', upgrade: 3 },
  ],
  heroes: [{ id: 'h1' }],
  fidelity: {
    account: { status: 'stale', capturedAt: EARLIER },
    heroes: { status: 'resolved', capturedAt: EARLIER },
    skills: { status: 'missing' },
    casa: { status: 'missing' },
    items: { status: 'resolved', capturedAt: EARLIER },
  },
};

describe('patchAccountAfterForge', () => {
  it('lays the server\'s item over its row, the wallet over the account, and re-stamps only those two sections', () => {
    const patched = patchAccountAfterForge(
      PAYLOAD,
      { itemId: 'g1', item: { id: 'g1', def_id: 'steel_luva', upgrade: 10, power: 55 }, gold: 999_700 },
      NOW,
    );
    expect(patched.items).toEqual([
      { id: 'g1', def_id: 'steel_luva', upgrade: 10, power: 55 },
      { id: 'g2', def_id: 'steel_elmo', upgrade: 3 },
    ]);
    expect(patched.account).toEqual({ gold: 999_700, phase: 12 });
    expect(patched.heroes).toBe(PAYLOAD.heroes);
    expect(patched.fidelity).toEqual({
      account: { status: 'resolved', capturedAt: NOW },
      heroes: { status: 'resolved', capturedAt: EARLIER },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'resolved', capturedAt: NOW },
    });
  });

  it('keeps the piece on its hero when the reply comes back without a wearer', () => {
    const worn: AccountPayload = {
      ...PAYLOAD,
      items: [{ id: 'g1', def_id: 'steel_luva', upgrade: 12, equipped_on: 'h1', equip_slot: 5, in_stash: false }],
    };
    const patched = patchAccountAfterForge(
      worn,
      {
        itemId: 'g1',
        item: { id: 'g1', def_id: 'steel_luva', upgrade: 13, equipped_on: null, equip_slot: null, in_stash: false },
        gold: null,
      },
      NOW,
    );
    expect(patched.items).toEqual([
      { id: 'g1', def_id: 'steel_luva', upgrade: 13, equipped_on: 'h1', equip_slot: 5, in_stash: false },
    ]);
  });

  it('keeps the row id it matched on when the reply spells the id another way', () => {
    const patched = patchAccountAfterForge(PAYLOAD, { itemId: 'g1', item: { id: 1, upgrade: 9 }, gold: null }, NOW);
    expect(patched.items?.[0]).toMatchObject({ id: 'g1', upgrade: 9 });
  });

  it('leaves the account section and its stamp alone when the server reported no wallet', () => {
    const patched = patchAccountAfterForge(PAYLOAD, { itemId: 'g1', item: { upgrade: 9 }, gold: null }, NOW);
    expect(patched.account).toBe(PAYLOAD.account);
    expect(patched.fidelity?.account).toEqual({ status: 'stale', capturedAt: EARLIER });
    expect(patched.fidelity?.items).toEqual({ status: 'resolved', capturedAt: NOW });
  });

  it('does not invent an items section for a payload that has none', () => {
    const patched = patchAccountAfterForge({ account: { gold: 1 } }, { itemId: 'g1', item: { upgrade: 9 }, gold: 5 }, NOW);
    expect(patched.items).toBeUndefined();
    expect(patched.account).toEqual({ gold: 5 });
    expect(patched.fidelity).toBeUndefined();
  });
});
