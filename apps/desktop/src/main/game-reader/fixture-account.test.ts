import { describe, expect, it } from 'vitest';
import { buildFixtureAccountPayload } from './fixture-account.js';
import { loadFixtureBundle } from './fixture-data.js';

const NOW = '2026-08-12T00:00:00.000Z';

describe('buildFixtureAccountPayload', () => {
  it('resolves account, heroes and items, all stamped with the given timestamp', () => {
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload.fidelity?.account).toEqual({ status: 'resolved', capturedAt: NOW });
    expect(payload.fidelity?.heroes).toEqual({ status: 'resolved', capturedAt: NOW });
    expect(payload.fidelity?.items).toEqual({ status: 'resolved', capturedAt: NOW });
  });

  it('leaves skills and casa missing — no fixture exists for either', () => {
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload.fidelity?.skills).toEqual({ status: 'missing' });
    expect(payload.fidelity?.casa).toEqual({ status: 'missing' });
    expect(payload.skills).toBeUndefined();
    expect(payload.casa).toBeUndefined();
  });

  it('sources account from the state-push-a.json fixture verbatim', () => {
    const fixtures = loadFixtureBundle();
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload.account).toEqual(fixtures.state);
  });

  it('sources heroes from the hero-record.json fixture as a single-element array', () => {
    const fixtures = loadFixtureBundle();
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload.heroes).toEqual(fixtures.heroRecords);
    expect(payload.heroes).toHaveLength(1);
  });

  it("sources items from the inventory-bag-v2.json fixture's items array, not the bag wrapper", () => {
    const fixtures = loadFixtureBundle();
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload.items).toEqual(fixtures.inventory.items);
    expect(Array.isArray(payload.items)).toBe(true);
  });

  it('produces a different capturedAt when called with a different timestamp', () => {
    const later = '2026-08-12T01:00:00.000Z';
    const first = buildFixtureAccountPayload(NOW);
    const second = buildFixtureAccountPayload(later);
    expect(first.fidelity?.account.capturedAt).toBe(NOW);
    expect(second.fidelity?.account.capturedAt).toBe(later);
  });

  it('is a pure function of its input — no Electron, no hidden state affecting the shape', () => {
    const first = buildFixtureAccountPayload(NOW);
    const second = buildFixtureAccountPayload(NOW);
    expect(first).toEqual(second);
  });
});
