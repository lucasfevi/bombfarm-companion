import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { patchAccountAfterDeconstruct } from './deconstruct-account-patch.js';

const NOW = '2026-10-05T10:00:30.000Z';
const EARLIER = '2026-10-05T09:00:00.000Z';

const PAYLOAD: AccountPayload = {
  account: { gold: '1000000', essence: 500, items_count: 4, phase: 12 },
  items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
  heroes: [{ id: 'h1' }],
  fidelity: {
    account: { status: 'stale', capturedAt: EARLIER },
    heroes: { status: 'resolved', capturedAt: EARLIER },
    skills: { status: 'missing' },
    casa: { status: 'missing' },
    items: { status: 'resolved', capturedAt: EARLIER },
  },
};

describe('patchAccountAfterDeconstruct', () => {
  it('removes exactly the burned ids, keeps every other row in order, and sets the balance', () => {
    const patched = patchAccountAfterDeconstruct(PAYLOAD, { itemIds: ['2', '4'], essence: 590 }, NOW);
    expect(patched.items).toEqual([{ id: '1' }, { id: '3' }]);
    expect(patched.account).toEqual({ gold: '1000000', essence: 590, items_count: 4, phase: 12 });
  });

  it('re-stamps only the items and account sections', () => {
    const patched = patchAccountAfterDeconstruct(PAYLOAD, { itemIds: ['1'], essence: 510 }, NOW);
    expect(patched.fidelity).toEqual({
      account: { status: 'resolved', capturedAt: NOW },
      heroes: { status: 'resolved', capturedAt: EARLIER },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'resolved', capturedAt: NOW },
    });
    expect(patched.heroes).toBe(PAYLOAD.heroes);
  });

  it('leaves the account\'s own item count for the re-read instead of guessing it', () => {
    const patched = patchAccountAfterDeconstruct(PAYLOAD, { itemIds: ['1', '2'], essence: 520 }, NOW);
    expect(patched.account).toMatchObject({ items_count: 4 });
  });

  it('ignores ids that are not in the bag and leaves rows with a non-string id alone', () => {
    const odd: AccountPayload = { ...PAYLOAD, items: [{ id: 7 }, { id: '1' }, 'stray'] };
    const patched = patchAccountAfterDeconstruct(odd, { itemIds: ['7', '1', '99'], essence: 1 }, NOW);
    expect(patched.items).toEqual([{ id: 7 }, 'stray']);
  });

  it('does not mutate the payload it was given', () => {
    const before = JSON.stringify(PAYLOAD);
    patchAccountAfterDeconstruct(PAYLOAD, { itemIds: ['1'], essence: 510 }, NOW);
    expect(JSON.stringify(PAYLOAD)).toBe(before);
  });

  it('does not invent an items section or fidelity for a payload that has none, but still carries the balance', () => {
    const patched = patchAccountAfterDeconstruct({ account: { essence: 1 } }, { itemIds: ['1'], essence: 9 }, NOW);
    expect(patched.items).toBeUndefined();
    expect(patched.fidelity).toBeUndefined();
    expect(patched.account).toEqual({ essence: 9 });
  });

  it('creates the account section when the payload had none, so the balance is not lost', () => {
    const patched = patchAccountAfterDeconstruct({ items: [{ id: '1' }] }, { itemIds: ['1'], essence: 9 }, NOW);
    expect(patched.account).toEqual({ essence: 9 });
    expect(patched.items).toEqual([]);
  });
});
