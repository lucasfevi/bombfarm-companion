import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('AD-039 — BFC_FIXTURE_ACCOUNT_FILE override', () => {
  let dir: string;
  let overridePath: string;
  const overridePayload = {
    account: { phase: 5 },
    heroes: [{ id: 'override-hero' }],
    fidelity: {
      account: { status: 'resolved', capturedAt: NOW },
      heroes: { status: 'resolved', capturedAt: NOW },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'missing' },
    },
  };

  const savedEnv = { BFC_GAME_READER: process.env.BFC_GAME_READER, BFC_FIXTURE_ACCOUNT_FILE: process.env.BFC_FIXTURE_ACCOUNT_FILE };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bfc-fixture-override-'));
    overridePath = join(dir, 'account-override.json');
    writeFileSync(overridePath, JSON.stringify(overridePayload));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (savedEnv.BFC_GAME_READER === undefined) delete process.env.BFC_GAME_READER;
    else process.env.BFC_GAME_READER = savedEnv.BFC_GAME_READER;
    if (savedEnv.BFC_FIXTURE_ACCOUNT_FILE === undefined) delete process.env.BFC_FIXTURE_ACCOUNT_FILE;
    else process.env.BFC_FIXTURE_ACCOUNT_FILE = savedEnv.BFC_FIXTURE_ACCOUNT_FILE;
  });

  it('is honoured when BFC_GAME_READER is "fixture" and BFC_FIXTURE_ACCOUNT_FILE is set', () => {
    process.env.BFC_GAME_READER = 'fixture';
    process.env.BFC_FIXTURE_ACCOUNT_FILE = overridePath;
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload).toEqual(overridePayload);
  });

  it('is ignored when BFC_GAME_READER is "memory" — the committed fixture bundle is used instead', () => {
    process.env.BFC_GAME_READER = 'memory';
    process.env.BFC_FIXTURE_ACCOUNT_FILE = overridePath;
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload).not.toEqual(overridePayload);
    expect(payload.fidelity?.heroes).toEqual({ status: 'resolved', capturedAt: NOW });
  });

  it('is ignored when BFC_GAME_READER is unset — the committed fixture bundle is used instead', () => {
    delete process.env.BFC_GAME_READER;
    process.env.BFC_FIXTURE_ACCOUNT_FILE = overridePath;
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload).not.toEqual(overridePayload);
  });

  it('is ignored when BFC_GAME_READER is any other value — the committed fixture bundle is used instead', () => {
    process.env.BFC_GAME_READER = 'not-a-real-mode';
    process.env.BFC_FIXTURE_ACCOUNT_FILE = overridePath;
    const payload = buildFixtureAccountPayload(NOW);
    expect(payload).not.toEqual(overridePayload);
  });

  it('falls back to the committed fixture bundle when BFC_GAME_READER is "fixture" but BFC_FIXTURE_ACCOUNT_FILE is unset', () => {
    process.env.BFC_GAME_READER = 'fixture';
    delete process.env.BFC_FIXTURE_ACCOUNT_FILE;
    const payload = buildFixtureAccountPayload(NOW);
    const fixtures = loadFixtureBundle();
    expect(payload.heroes).toEqual(fixtures.heroRecords);
  });

  it('is ignored when packaged, even with BFC_GAME_READER "fixture" and BFC_FIXTURE_ACCOUNT_FILE set', () => {
    process.env.BFC_GAME_READER = 'fixture';
    process.env.BFC_FIXTURE_ACCOUNT_FILE = overridePath;
    const payload = buildFixtureAccountPayload(NOW, true);
    expect(payload).not.toEqual(overridePayload);
    expect(payload.fidelity?.heroes).toEqual({ status: 'resolved', capturedAt: NOW });
  });
});
