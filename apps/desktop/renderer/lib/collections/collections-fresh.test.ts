import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, CollectionAxisValues, SectionFidelity } from '@bombfarm/contracts';
import {
  accountCollectionTotals,
  collectionFreshnessDecision,
  collectionTotalsCovered,
  collectionTotalsKey,
} from './collections-fresh';
import { collectionsSnapshotFixture } from './collections-test-fixture';

const held = collectionsSnapshotFixture().totals;
const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: '2026-10-02T10:00:00.000Z' };

function fidelity(skills: SectionFidelity): AccountFidelity {
  return { account: RESOLVED, heroes: RESOLVED, skills, casa: RESOLVED, items: RESOLVED };
}

function payload(colecao: Record<string, number> | null, skills: SectionFidelity = RESOLVED): AccountPayload {
  return {
    skills: { totals: colecao === null ? {} : { colecao } },
    fidelity: fidelity(skills),
  };
}

const HELD_ON_THE_WIRE = {
  dano: 30,
  critd: 2.31,
  critc: 11.4,
  recarga: 1.17,
  energia: 11.25,
  ouro: 7.74,
  xp: 0,
  sorte: 0.64,
  jaula: 10.9,
  forja: 0.38,
};

describe('accountCollectionTotals', () => {
  it('maps the ten wire axes of skills.totals.colecao onto the contract’s axes', () => {
    expect(accountCollectionTotals(payload(HELD_ON_THE_WIRE))).toEqual(held);
  });

  it('reads an axis the block leaves out as zero', () => {
    const totals = accountCollectionTotals(payload({ ouro: 7.74 }));
    expect(totals?.gold).toBe(7.74);
    expect(totals?.damage).toBe(0);
  });

  it('says nothing when the read carries no Collections block, rather than saying zero', () => {
    expect(accountCollectionTotals(payload(null))).toBeNull();
    expect(accountCollectionTotals({ fidelity: fidelity(RESOLVED) })).toBeNull();
  });

  it('says nothing when the skills section is not usable', () => {
    expect(accountCollectionTotals(payload(HELD_ON_THE_WIRE, { status: 'missing' }))).toBeNull();
  });

  it('still reads a stale skills section, which the rest of the app also trusts', () => {
    expect(accountCollectionTotals(payload(HELD_ON_THE_WIRE, { status: 'stale', capturedAt: '2026-10-02T09:00:00.000Z' }))).toEqual(held);
  });
});

describe('collectionTotalsKey', () => {
  it('is the same for totals that agree to the hundredth', () => {
    const nudged: CollectionAxisValues = { ...held, gold: 7.7400000001 };
    expect(collectionTotalsKey(nudged)).toBe(collectionTotalsKey(held));
  });

  it('differs when any one axis moves by a hundredth', () => {
    expect(collectionTotalsKey({ ...held, luck: held.luck + 0.01 })).not.toBe(collectionTotalsKey(held));
  });
});

describe('collectionFreshnessDecision', () => {
  const moved: CollectionAxisValues = { ...held, gold: held.gold + 0.25 };

  it('asks for a read when the account’s totals differ from the held snapshot’s', () => {
    expect(collectionFreshnessDecision({ account: moved, held, askedFor: null })).toEqual({
      ask: true,
      key: collectionTotalsKey(moved),
    });
  });

  it('does not ask while the two agree', () => {
    expect(collectionFreshnessDecision({ account: { ...held }, held, askedFor: null })).toEqual({ ask: false });
  });

  it('asks again once the totals move to a different value', () => {
    const asked = collectionTotalsKey(moved);
    const movedAgain: CollectionAxisValues = { ...held, gold: held.gold + 0.5 };
    expect(collectionFreshnessDecision({ account: moved, held, askedFor: asked })).toEqual({ ask: false });
    expect(collectionFreshnessDecision({ account: movedAgain, held, askedFor: asked }).ask).toBe(true);
  });

  it('does not loop on a refusal: the same unmatched totals are asked for once', () => {
    const first = collectionFreshnessDecision({ account: moved, held, askedFor: null });
    expect(first.ask).toBe(true);
    const askedFor = first.ask ? first.key : null;
    for (let push = 0; push < 3; push += 1) {
      expect(collectionFreshnessDecision({ account: moved, held, askedFor })).toEqual({ ask: false });
    }
  });

  it('asks nothing without the account’s totals or without a snapshot to compare to', () => {
    expect(collectionFreshnessDecision({ account: null, held, askedFor: null })).toEqual({ ask: false });
    expect(collectionFreshnessDecision({ account: moved, held: null, askedFor: null })).toEqual({ ask: false });
  });
});

describe('collectionTotalsCovered', () => {
  it('is the key of the account totals present when the tab opened, so the opening read is not asked for twice', () => {
    const moved: CollectionAxisValues = { ...held, gold: held.gold + 0.25 };
    const covered = collectionTotalsCovered(moved);
    expect(covered).toBe(collectionTotalsKey(moved));
    expect(collectionFreshnessDecision({ account: moved, held, askedFor: covered })).toEqual({ ask: false });
  });

  it('covers nothing when the account had no totals to show yet', () => {
    expect(collectionTotalsCovered(null)).toBeNull();
  });
});
